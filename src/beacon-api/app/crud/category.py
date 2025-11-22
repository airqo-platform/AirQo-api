from typing import List, Optional
from sqlmodel import Session, select
from fastapi import HTTPException
from app.crud.base import CRUDBase
from app.models.category import Category, CategoryCreate, CategoryUpdate, CategoryRead, CategoryWithDevices, DeviceConfigSummary
from app.models.device import Device
from app.models.config_value import ConfigValues


class CRUDCategory(CRUDBase[Category, CategoryCreate, CategoryUpdate]):
    
    def create(self, db: Session, *, obj_in: CategoryCreate) -> CategoryRead:
        """Create a new category with field/config/metadata mapping"""
        # Check for duplicate category name
        existing = self.get_by_name(db, name=obj_in.name)
        if existing:
            raise HTTPException(
                status_code=400, 
                detail=f"Category name '{obj_in.name}' already exists."
            )
        
        # Unpack fields/configs/metadata from dicts to model columns
        fields = obj_in.fields or {}
        configs = obj_in.configs or {}
        metadata = obj_in.metadata or {}
        
        # Create the category object
        db_obj = Category(
            name=obj_in.name,
            description=obj_in.description,
            **fields,
            **configs,
            **metadata,
        )
        
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        
        # Convert back to proper format for response
        return self._to_category_read(db_obj)
    
    def get_by_name(self, db: Session, *, name: str) -> Optional[Category]:
        """Get a category by its unique name"""
        statement = select(Category).where(Category.name == name)
        return db.exec(statement).first()
    
    def get(self, db: Session, id: str) -> Optional[CategoryRead]:
        """Get a category by its primary key (name)"""
        statement = select(Category).where(Category.name == id)
        category = db.exec(statement).first()
        if category:
            return self._to_category_read(category)
        return None
    
    def get_all(self, db: Session, *, skip: int = 0, limit: int = 100) -> List[CategoryRead]:
        """Get all categories with pagination"""
        statement = select(Category).offset(skip).limit(limit).order_by(Category.name)
        categories = db.exec(statement).all()
        return [self._to_category_read(cat) for cat in categories]
    
    def get_with_devices(
        self, 
        db: Session, 
        id: str,
        skip: int = 0,
        limit: Optional[int] = 25,
        network: Optional[str] = None,
        search: Optional[str] = None
    ) -> Optional[CategoryWithDevices]:
        """
        Get a category with its associated devices with pagination and filtering.
        
        Args:
            db: Database session
            id: Category name (primary key)
            skip: Number of records to skip
            limit: Maximum number of records to return
            network: Filter devices by network
            search: Search term to filter devices by name or device_id
        """
        from sqlmodel import func
        
        statement = select(Category).where(Category.name == id)
        category = db.exec(statement).first()
        
        if not category:
            return None
        
        # Build query for devices associated with this category
        devices_query = select(Device).where(Device.category == category.name)
        
        # Apply network filter if provided
        if network:
            devices_query = devices_query.where(Device.network == network)
        
        # Apply search filter if provided
        if search:
            search_pattern = f"%{search}%"
            devices_query = devices_query.where(
                (Device.device_name.ilike(search_pattern)) |
                (Device.device_id.ilike(search_pattern)) |
                (Device.site_id.ilike(search_pattern))
            )
        
        # Get total count before pagination
        count_query = select(func.count(Device.device_key)).where(Device.category == category.name)
        if network:
            count_query = count_query.where(Device.network == network)
        if search:
            search_pattern = f"%{search}%"
            count_query = count_query.where(
                (Device.device_name.ilike(search_pattern)) |
                (Device.device_id.ilike(search_pattern)) |
                (Device.site_id.ilike(search_pattern))
            )
        
        total_devices = db.exec(count_query).first() or 0
        
        # Apply ordering and pagination
        devices_query = devices_query.order_by(Device.device_name)
        devices_query = devices_query.offset(skip)
        if limit is not None:
            devices_query = devices_query.limit(limit)
        
        devices = db.exec(devices_query).all()
        
        device_list = []
        for device in devices:
            # Get most recent config for the device using device_id (string)
            config_statement = (
                select(ConfigValues)
                .where(ConfigValues.device_id == device.device_id)
                .order_by(ConfigValues.created_at.desc())
                .limit(1)
            )
            recent_config = db.exec(config_statement).first()
            
            # Build config_values dict with config1, config2, etc. as keys
            config_values = {}
            config_updated = False
            
            if recent_config:
                config_updated = recent_config.config_updated or False
                
                # Iterate through all 10 possible config fields
                for i in range(1, 11):
                    config_key = f'config{i}'
                    # Get the category's config field name to check if this config exists
                    category_config_name = getattr(category, config_key, None)
                    
                    if category_config_name:  # Only include if category has this config defined
                        # Get the device's value for this config and use config1, config2, etc. as key
                        device_config_value = getattr(recent_config, config_key, None)
                        config_values[config_key] = device_config_value
            else:
                # No config yet - still show category's config fields with None values
                for i in range(1, 11):
                    config_key = f'config{i}'
                    category_config_name = getattr(category, config_key, None)
                    if category_config_name:
                        config_values[config_key] = None
            
            device_list.append(DeviceConfigSummary(
                name=device.device_name,
                device_id=device.device_id,
                device_key=str(device.device_key),
                config_updated=config_updated,
                recent_config=config_values
            ))
        
        # Convert to CategoryRead format
        category_read = self._to_category_read(category)
        
        # Calculate pagination metadata
        returned_count = len(device_list)
        total_pages = 0 if limit is None else (total_devices + limit - 1) // limit if limit > 0 else 0
        current_page = 0 if limit is None else (skip // limit) + 1 if limit > 0 else 1
        has_next = (skip + returned_count) < total_devices
        has_previous = skip > 0
        
        from app.models.category import CategoryDevicesPagination
        
        pagination = CategoryDevicesPagination(
            total=total_devices,
            skip=skip,
            limit=limit,
            returned=returned_count,
            pages=total_pages,
            current_page=current_page,
            has_next=has_next,
            has_previous=has_previous
        )
        
        return CategoryWithDevices(
            **category_read.model_dump(),
            device_count=total_devices,
            devices=device_list,
            pagination=pagination
        )
    
    def _to_category_read(self, category: Category) -> CategoryRead:
        """Convert a Category model to CategoryRead schema"""
        fields = {f'field{i}': getattr(category, f'field{i}') 
                 for i in range(1, 16) if getattr(category, f'field{i}')}
        configs = {f'config{i}': getattr(category, f'config{i}') 
                  for i in range(1, 11) if getattr(category, f'config{i}')}
        metadata = {f'metadata{i}': getattr(category, f'metadata{i}') 
                   for i in range(1, 16) if getattr(category, f'metadata{i}')}
        
        return CategoryRead(
            name=category.name,
            description=category.description,
            created_at=category.created_at,
            updated_at=category.updated_at,
            fields=fields if fields else None,
            configs=configs if configs else None,
            metadata=metadata if metadata else None
        )


category = CRUDCategory(Category)
