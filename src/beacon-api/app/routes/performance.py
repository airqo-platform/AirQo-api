from fastapi import APIRouter, Depends, HTTPException, Path, Body, Query
from sqlmodel import Session, select
from typing import List, Literal
from datetime import datetime, timedelta
from app.deps import get_db
from app.models.performance import (
    PerformanceQueryRequest,
    PerformanceResponse,
    GroupedPerformanceResponse
)
from app.models.device import Device
from app.models.airqloud import AirQloud
from app.crud import device_performance, airqloud_performance
from app.utils.performance_fetcher import (
    ensure_device_performance_data,
    ensure_airqloud_performance_data,
    ensure_multiple_devices_performance_data,
    ensure_multiple_airqlouds_performance_data
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def generate_complete_timestamps(
    start_date: datetime,
    end_date: datetime,
    type: str
) -> List[datetime]:
    """
    Generate complete list of expected timestamps based on type
    - device: hourly timestamps
    - airqloud: daily timestamps (at midnight 00:00:00)
    """
    timestamps = []
    
    if type == "device":
        # Hourly timestamps
        current = start_date.replace(minute=0, second=0, microsecond=0)
        while current <= end_date:
            timestamps.append(current)
            current += timedelta(hours=1)
    elif type == "airqloud":
        # Daily timestamps - normalize to start of day (00:00:00)
        # This matches how airqloud performance is stored in the database
        current = start_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_normalized = end_date.replace(hour=0, minute=0, second=0, microsecond=0)
        while current <= end_normalized:
            timestamps.append(current)
            current += timedelta(days=1)
    
    return timestamps


def fill_missing_timestamps(
    existing_records: List[PerformanceResponse],
    all_ids: List[str],
    start_date: datetime,
    end_date: datetime,
    type: str
) -> List[PerformanceResponse]:
    """
    Fill in missing timestamps with null/zero values for all IDs
    """
    # Generate all expected timestamps
    expected_timestamps = generate_complete_timestamps(start_date, end_date, type)
    
    # Create a map of existing records - normalize timestamps for comparison
    existing_map = {}
    for record in existing_records:
        # Normalize the timestamp from DB to match expected format
        if type == "airqloud":
            # For airqloud, normalize to start of day in UTC
            normalized_ts = record.timestamp.replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        else:
            # For device, normalize to start of hour
            normalized_ts = record.timestamp.replace(minute=0, second=0, microsecond=0, tzinfo=None)
        
        key = (record.id, normalized_ts)
        existing_map[key] = record
        
    logger.info(f"fill_missing_timestamps: Created map with {len(existing_map)} existing records")
    if existing_map:
        sample_key = list(existing_map.keys())[0]
        logger.info(f"fill_missing_timestamps: Sample key: {sample_key}")
    
    # Build complete response with all timestamps
    complete_response = []
    
    for entity_id in all_ids:
        for timestamp in expected_timestamps:
            # Remove timezone info for comparison
            ts_naive = timestamp.replace(tzinfo=None) if timestamp.tzinfo else timestamp
            key = (entity_id, ts_naive)
            
            if key in existing_map:
                # Use existing record
                complete_response.append(existing_map[key])
            else:
                # Create placeholder record with null/zero values
                complete_response.append(
                    PerformanceResponse(
                        id=entity_id,
                        freq=0,
                        error_margin=None,
                        timestamp=timestamp,
                        performance_key=0,  # Placeholder
                        created_at=None
                    )
                )
    
    # Sort by timestamp and id
    complete_response.sort(key=lambda x: (x.timestamp, x.id))
    
    logger.info(f"fill_missing_timestamps: Returning {len(complete_response)} total records "
               f"({len(existing_map)} existing + {len(complete_response) - len(existing_map)} placeholders)")
    
    return complete_response


def group_performance_by_id(
    performance_records: List[PerformanceResponse],
    names_map: dict[str, str] = None
) -> List[GroupedPerformanceResponse]:
    """
    Group performance records by ID, creating arrays for freq, error_margin, and timestamp
    
    Args:
        performance_records: List of performance records to group
        names_map: Optional dictionary mapping IDs to names
    """
    # Group records by ID
    grouped_data = {}
    
    for record in performance_records:
        if record.id not in grouped_data:
            grouped_data[record.id] = {
                'freq': [],
                'error_margin': [],
                'timestamp': []
            }
        
        grouped_data[record.id]['freq'].append(record.freq)
        grouped_data[record.id]['error_margin'].append(record.error_margin)
        grouped_data[record.id]['timestamp'].append(record.timestamp)
    
    # Convert to response models
    grouped_response = [
        GroupedPerformanceResponse(
            id=entity_id,
            name=names_map.get(entity_id) if names_map else None,
            freq=data['freq'],
            error_margin=data['error_margin'],
            timestamp=data['timestamp']
        )
        for entity_id, data in grouped_data.items()
    ]
    
    # Sort by ID for consistency
    grouped_response.sort(key=lambda x: x.id)
    
    return grouped_response


# @router.post("/{type}", response_model=List[PerformanceResponse])
# def get_performance_data(
#     *,
#     db: Session = Depends(get_db),
#     type: Literal["device", "airqloud"] = Path(
#         ..., 
#         description="Performance type: 'device' for device performance or 'airqloud' for airqloud performance"
#     ),
#     query: PerformanceQueryRequest = Body(
#         ...,
#         example={
#             "start": "2024-06-01T00:00:00Z",
#             "end": "2024-06-30T23:59:59Z",
#             "ids": ["device_id_1", "device_id_2", "device_id_3"]
#         }
#     )
# ):
#     """
#     Get performance data for devices or airqlouds within a specified date range.
    
#     **Path Parameters:**
#     - **type**: Either 'device' or 'airqloud' to specify the type of performance data
    
#     **Request Body:**
#     ```json
#     {
#         "start": "2024-06-01T00:00:00Z",
#         "end": "2024-06-30T23:59:59Z",
#         "ids": ["id1", "id2", "id3"]
#     }
#     ```
    
#     **Fields:**
#     - **start**: Start datetime in ISO 8601 format (UTC timezone recommended)
#     - **end**: End datetime in ISO 8601 format (UTC timezone recommended)
#     - **ids**: List of device IDs (when type='device') or airqloud IDs (when type='airqloud')
    
#     **Examples:**
    
#     Get device performance:
#     ```
#     POST /performance/device
#     {
#         "start": "2024-06-01T00:00:00Z",
#         "end": "2024-06-30T23:59:59Z",
#         "ids": ["aq_device_001", "aq_device_002"]
#     }
#     ```
    
#     Get airqloud performance:
#     ```
#     POST /performance/airqloud
#     {
#         "start": "2024-06-01T00:00:00Z",
#         "end": "2024-06-30T23:59:59Z",
#         "ids": ["airqloud_kampala", "airqloud_nairobi"]
#     }
#     ```
    
#     **Returns:**
#     List of performance records with unified structure:
#     - **performance_key**: Unique identifier for the performance record
#     - **id**: The entity ID (device_id or airqloud_id)
#     - **freq**: Frequency value
#     - **error_margin**: Error margin value
#     - **timestamp**: When the performance was recorded
#     - **created_at**: When the record was created in the database
#     """
#     try:
#         # Validate date range
#         if query.start >= query.end:
#             raise HTTPException(
#                 status_code=400,
#                 detail="Start date must be before end date"
#             )
        
#         # Validate IDs list
#         if not query.ids or len(query.ids) == 0:
#             raise HTTPException(
#                 status_code=400,
#                 detail="At least one ID must be provided in the 'ids' list"
#             )
        
#         # Ensure data exists for the requested range (fetch missing data if needed)
#         logger.info(f"Ensuring data availability for {type} performance")
#         if type == "device":
#             ensure_multiple_devices_performance_data(db, query.ids, query.start, query.end)
#         elif type == "airqloud":
#             ensure_multiple_airqlouds_performance_data(db, query.ids, query.start, query.end)
        
#         # Route to appropriate CRUD operation based on type
#         if type == "device":
#             logger.info(f"Fetching device performance for {len(query.ids)} devices from {query.start} to {query.end}")
#             logger.info(f"Device IDs: {query.ids}")
#             results = device_performance.get_performance_by_devices(
#                 db,
#                 device_ids=query.ids,
#                 start_date=query.start,
#                 end_date=query.end
#             )
#             # Convert to unified response format
#             existing_records = [
#                 PerformanceResponse(
#                     id=record.device_id,
#                     freq=record.freq,
#                     error_margin=record.error_margin,
#                     timestamp=record.timestamp,
#                     performance_key=record.performance_key,
#                     created_at=record.created_at
#                 )
#                 for record in results
#             ]
#         elif type == "airqloud":
#             logger.info(f"Fetching airqloud performance for {len(query.ids)} airqlouds from {query.start} to {query.end}")
#             logger.info(f"AirQloud IDs: {query.ids}")
#             results = airqloud_performance.get_performance_by_airqlouds(
#                 db,
#                 airqloud_ids=query.ids,
#                 start_date=query.start,
#                 end_date=query.end
#             )
#             # Convert to unified response format
#             existing_records = [
#                 PerformanceResponse(
#                     id=record.airqloud_id,
#                     freq=record.freq,
#                     error_margin=record.error_margin,
#                     timestamp=record.timestamp,
#                     performance_key=record.performance_key,
#                     created_at=record.created_at
#                 )
#                 for record in results
#             ]
#         else:
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"Invalid type '{type}'. Must be either 'device' or 'airqloud'"
#             )
        
#         logger.info(f"Retrieved {len(existing_records)} existing performance records for type '{type}'")
        
#         # Note: Data fetching is now handled automatically by ensure_*_performance_data functions
#         # called earlier in this endpoint. The fetch logs ensure we only fetch what's missing.
        
#         # Fill in missing timestamps with null/zero values (for hours where devices didn't report)
#         complete_response = fill_missing_timestamps(
#             existing_records=existing_records,
#             all_ids=query.ids,
#             start_date=query.start,
#             end_date=query.end,
#             type=type
#         )
        
#         logger.info(f"Returning {len(complete_response)} performance records for type '{type}'")
#         return complete_response
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         logger.error(f"Error retrieving performance data: {str(e)}")
#         raise HTTPException(
#             status_code=500,
#             detail=f"An error occurred while retrieving performance data: {str(e)}"
#         )


@router.post("/{type}", response_model=List[GroupedPerformanceResponse])
def get_grouped_performance_data(
    *,
    db: Session = Depends(get_db),
    type: Literal["device", "airqloud"] = Path(
        ..., 
        description="Performance type: 'device' for device performance or 'airqloud' for airqloud performance"
    ),
    query: PerformanceQueryRequest = Body(
        ...,
        example={
            "start": "2024-06-01T00:00:00Z",
            "end": "2024-06-30T23:59:59Z",
            "ids": ["device_id_1", "device_id_2", "device_id_3"]
        }
    )
):
    """
    Get grouped performance data for devices or airqlouds.
    
    Returns data grouped by ID with arrays for freq, error_margin, and timestamp.
    
    **Path Parameters:**
    - **type**: Either 'device' or 'airqloud' to specify the type of performance data
    
    **Request Body:**
    ```json
    {
        "start": "2024-06-01T00:00:00Z",
        "end": "2024-06-30T23:59:59Z",
        "ids": ["id1", "id2", "id3"]
    }
    ```
    
    **Returns:**
    ```json
    [
        {
            "id": "device_id_1",
            "freq": [45, 52, 48, ...],
            "error_margin": [2.34, 1.89, 3.12, ...],
            "timestamp": ["2024-06-01T00:00:00Z", "2024-06-01T01:00:00Z", ...]
        },
        {
            "id": "device_id_2",
            "freq": [50, 49, 51, ...],
            "error_margin": [1.23, 2.45, 1.67, ...],
            "timestamp": ["2024-06-01T00:00:00Z", "2024-06-01T01:00:00Z", ...]
        }
    ]
    ```
    """
    try:
        # Validate date range
        if query.start >= query.end:
            raise HTTPException(
                status_code=400,
                detail="Start date must be before end date"
            )
        
        # Validate IDs list
        if not query.ids or len(query.ids) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one ID must be provided in the 'ids' list"
            )
        
        # Ensure data exists for the requested range
        logger.info(f"Ensuring data availability for {type} performance (grouped)")
        if type == "device":
            ensure_multiple_devices_performance_data(db, query.ids, query.start, query.end)
        elif type == "airqloud":
            ensure_multiple_airqlouds_performance_data(db, query.ids, query.start, query.end)
        
        # Fetch performance data
        if type == "device":
            logger.info(f"Fetching device performance for {len(query.ids)} devices from {query.start} to {query.end}")
            results = device_performance.get_performance_by_devices(
                db,
                device_ids=query.ids,
                start_date=query.start,
                end_date=query.end
            )
            existing_records = [
                PerformanceResponse(
                    id=record.device_id,
                    freq=record.freq,
                    error_margin=record.error_margin,
                    timestamp=record.timestamp,
                    performance_key=record.performance_key,
                    created_at=record.created_at
                )
                for record in results
            ]
            
            # Fetch device names
            names_map = {}
            devices = db.query(Device).filter(Device.device_id.in_(query.ids)).all()
            for device in devices:
                names_map[device.device_id] = device.device_name
                
        elif type == "airqloud":
            logger.info(f"Fetching airqloud performance for {len(query.ids)} airqlouds from {query.start} to {query.end}")
            results = airqloud_performance.get_performance_by_airqlouds(
                db,
                airqloud_ids=query.ids,
                start_date=query.start,
                end_date=query.end
            )
            existing_records = [
                PerformanceResponse(
                    id=record.airqloud_id,
                    freq=record.freq,
                    error_margin=record.error_margin,
                    timestamp=record.timestamp,
                    performance_key=record.performance_key,
                    created_at=record.created_at
                )
                for record in results
            ]
            
            # Fetch airqloud names
            names_map = {}
            airqlouds = db.query(AirQloud).filter(AirQloud.id.in_(query.ids)).all()
            for airqloud in airqlouds:
                names_map[airqloud.id] = airqloud.name
                
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid type '{type}'. Must be either 'device' or 'airqloud'"
            )
        
        # Fill missing timestamps
        complete_response = fill_missing_timestamps(
            existing_records=existing_records,
            all_ids=query.ids,
            start_date=query.start,
            end_date=query.end,
            type=type
        )
        
        # Group by ID with names
        grouped_response = group_performance_by_id(complete_response, names_map)
        
        logger.info(f"Returning {len(grouped_response)} grouped performance records for type '{type}'")
        return grouped_response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving grouped performance data: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while retrieving grouped performance data: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """
    Health check endpoint for the performance service
    """
    return {
        "status": "healthy",
        "service": "performance",
        "timestamp": datetime.utcnow().isoformat()
    }
