import logging
import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Any
from uuid import UUID
from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.operations import DeviceJob
from app.repositories.operations import device_job_repo, device_session_repo, device_repo
from app.schemas.operations import DeviceJobCreate, DeviceJobUpdate
from app.services.redis_service import redis_service
from app.db.session import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def run_job_execution_task(job_id: UUID) -> None:
    """Background task executing the job steps and updating status/progress."""
    logger.info(f"Background worker starting execution of job {job_id}")
    async with AsyncSessionLocal() as db:
        job = await device_job_repo.get(db, job_id)
        if not job:
            logger.error(f"Job {job_id} not found in background execution task.")
            return

        if job.status != "QUEUED":
            logger.warning(f"Job {job_id} is in status {job.status}, expected QUEUED.")
            return

        # Transition to RUNNING
        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc)
        job.progress = 0
        await db.commit()
        await db.refresh(job)

        # Publish status update
        await redis_service.publish_to_session(str(job.session_id), {
            "event": "job_status",
            "job_id": str(job.id),
            "status": "RUNNING",
            "progress": 0,
            "started_at": job.started_at.isoformat()
        })

        # Notify the connected Agent about the new job
        if job.device_id:
            await redis_service.publish_to_agent(job.device_id, {
                "action": "execute_job",
                "job_id": str(job.id),
                "job_type": job.job_type,
                "firmware_id": str(job.firmware_id) if job.firmware_id else None,
                "metadata": job.meta_data
            })

        # Simulate job execution steps (e.g. 20% -> 40% -> 60% -> 80% -> 100%)
        steps = [20, 40, 60, 80, 100]
        success = True

        for p in steps:
            await asyncio.sleep(1.0)  # Simulate work interval

            # Check if job was cancelled
            cancelled = await redis_service.client.get(f"job:cancelled:{job.id}")
            if cancelled:
                logger.info(f"Job {job_id} was cancelled during execution.")
                job.status = "CANCELLED"
                job.completed_at = datetime.now(timezone.utc)
                await db.commit()
                
                await redis_service.publish_to_session(str(job.session_id), {
                    "event": "job_status",
                    "job_id": str(job.id),
                    "status": "CANCELLED",
                    "progress": p,
                    "completed_at": job.completed_at.isoformat()
                })
                success = False
                break

            # Update progress
            job.progress = p
            await db.commit()

            # Publish progress update
            await redis_service.publish_to_session(str(job.session_id), {
                "event": "job_progress",
                "job_id": str(job.id),
                "progress": p
            })

        if success:
            job.status = "COMPLETED"
            job.completed_at = datetime.now(timezone.utc)
            job.result = {
                "success": True,
                "message": f"Successfully completed {job.job_type} job on device {job.device_id}."
            }
            await db.commit()

            # Publish final completion update
            await redis_service.publish_to_session(str(job.session_id), {
                "event": "job_status",
                "job_id": str(job.id),
                "status": "COMPLETED",
                "progress": 100,
                "completed_at": job.completed_at.isoformat(),
                "result": job.result
            })
            logger.info(f"Job {job_id} completed successfully.")


class JobService:
    async def create_job(
        self, db: AsyncSession, obj_in: DeviceJobCreate, requested_by: str, background_tasks: BackgroundTasks
    ) -> DeviceJob:
        # Verify active session
        session = await device_session_repo.get(db, obj_in.session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {obj_in.session_id} not found."
            )
        if session.status != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot queue jobs for inactive sessions."
            )

        # Create job record
        db_data = obj_in.model_dump()
        db_data.update({
            "id": None,
            "status": "QUEUED",
            "progress": 0,
            "started_at": None,
            "completed_at": None,
            "requested_by": requested_by,
            "result": None
        })

        job = await device_job_repo.create(db, obj_in=db_data)

        # Publish event
        await redis_service.publish_to_session(str(job.session_id), {
            "event": "job_created",
            "job_id": str(job.id),
            "job_type": job.job_type,
            "status": job.status
        })

        # Add to background tasks runner
        background_tasks.add_task(run_job_execution_task, job.id)

        logger.info(f"Queued job {job.id} for session {job.session_id}")
        return job

    async def get_job(self, db: AsyncSession, job_id: UUID) -> DeviceJob:
        job = await device_job_repo.get(db, job_id)
        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job with ID {job_id} not found."
            )
        return job

    async def get_session_jobs(self, db: AsyncSession, session_id: UUID) -> List[DeviceJob]:
        return await device_job_repo.get_by_session(db, session_id)

    async def cancel_job(self, db: AsyncSession, job_id: UUID) -> DeviceJob:
        job = await self.get_job(db, job_id)
        if job.status not in ["QUEUED", "RUNNING"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel job in state {job.status}."
            )

        # If it was QUEUED, we can transition it directly
        if job.status == "QUEUED":
            job.status = "CANCELLED"
            job.completed_at = datetime.now(timezone.utc)
            await db.commit()
            await redis_service.publish_to_session(str(job.session_id), {
                "event": "job_status",
                "job_id": str(job.id),
                "status": "CANCELLED",
                "progress": job.progress,
                "completed_at": job.completed_at.isoformat()
            })
            logger.info(f"Cancelled queued job {job_id}")
            return job

        # If it is RUNNING, set cancellation flag in Redis. The background task will detect it and exit.
        await redis_service.client.set(f"job:cancelled:{job.id}", "1", ex=60)
        logger.info(f"Sent cancellation request for running job {job_id}")
        
        # Return current state (which will transition soon)
        return job

job_service = JobService()
