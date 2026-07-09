from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.repositories.base import BaseRepository
from app.models.operations import DeviceSession, DeviceJob, SessionLog, Command
from app.models.sync import SyncDevice
from app.models.firmware import Firmware

class DeviceSessionRepository(BaseRepository[DeviceSession]):
    def __init__(self) -> None:
        super().__init__(DeviceSession)

    async def get_active_by_device(self, db: AsyncSession, device_id: str) -> Optional[DeviceSession]:
        stmt = select(self.model).filter(
            self.model.device_id == device_id,
            self.model.status == "ACTIVE"
        ).order_by(self.model.started_at.desc())
        result = await db.execute(stmt)
        return result.scalars().first()

    async def get_active_sessions(self, db: AsyncSession) -> List[DeviceSession]:
        stmt = select(self.model).filter(self.model.status == "ACTIVE")
        result = await db.execute(stmt)
        return list(result.scalars().all())


class DeviceJobRepository(BaseRepository[DeviceJob]):
    def __init__(self) -> None:
        super().__init__(DeviceJob)

    async def get_by_session(self, db: AsyncSession, session_id: Any) -> List[DeviceJob]:
        stmt = select(self.model).filter(self.model.session_id == session_id).order_by(self.model.started_at.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_queued_and_running_jobs(self, db: AsyncSession) -> List[DeviceJob]:
        stmt = select(self.model).filter(self.model.status.in_(["QUEUED", "RUNNING"]))
        result = await db.execute(stmt)
        return list(result.scalars().all())


class SessionLogRepository(BaseRepository[SessionLog]):
    def __init__(self) -> None:
        super().__init__(SessionLog)

    async def get_by_session(self, db: AsyncSession, session_id: Any) -> List[SessionLog]:
        stmt = select(self.model).filter(self.model.session_id == session_id).order_by(self.model.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())


class CommandRepository(BaseRepository[Command]):
    def __init__(self) -> None:
        super().__init__(Command)

    async def get_by_name(self, db: AsyncSession, name: str) -> Optional[Command]:
        stmt = select(self.model).filter(self.model.name == name)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_enabled(self, db: AsyncSession) -> List[Command]:
        stmt = select(self.model).filter(self.model.enabled == True)
        result = await db.execute(stmt)
        return list(result.scalars().all())


class DeviceRepository(BaseRepository[SyncDevice]):
    def __init__(self) -> None:
        super().__init__(SyncDevice)

    async def get_by_device_id(self, db: AsyncSession, device_id: str) -> Optional[SyncDevice]:
        stmt = select(self.model).filter(self.model.device_id == device_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()


class FirmwareRepository(BaseRepository[Firmware]):
    def __init__(self) -> None:
        super().__init__(Firmware)

    async def get_by_version(self, db: AsyncSession, version: str) -> Optional[Firmware]:
        stmt = select(self.model).filter(self.model.firmware_version == version)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

# Singleton repository instances
device_session_repo = DeviceSessionRepository()
device_job_repo = DeviceJobRepository()
session_log_repo = SessionLogRepository()
command_repo = CommandRepository()
device_repo = DeviceRepository()
firmware_repo = FirmwareRepository()
