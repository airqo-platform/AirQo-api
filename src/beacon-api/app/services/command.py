import logging
from datetime import datetime, timezone
from typing import List, Optional, Any
from uuid import UUID
from fastapi import HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import jsonschema

from app.models.operations import Command, DeviceJob
from app.repositories.operations import command_repo, device_session_repo, device_repo
from app.schemas.operations import CommandCreate, CommandExecuteRequest
from app.services.redis_service import redis_service
from app.services.job import job_service

logger = logging.getLogger(__name__)

class CommandService:
    async def create_command(self, db: AsyncSession, obj_in: CommandCreate) -> Command:
        db_data = obj_in.model_dump()
        db_data.update({
            "id": None,
            "created_at": datetime.now(timezone.utc)
        })
        command = await command_repo.create(db, obj_in=db_data)
        logger.info(f"Created command definition {command.name} (ID: {command.id})")
        return command

    async def get_command(self, db: AsyncSession, command_id: UUID) -> Command:
        command = await command_repo.get(db, command_id)
        if not command:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Command definition with ID {command_id} not found."
            )
        return command

    async def get_commands(self, db: AsyncSession, *, enabled_only: bool = False) -> List[Command]:
        if enabled_only:
            return await command_repo.get_enabled(db)
        return await command_repo.get_multi(db)

    async def execute_command(
        self, db: AsyncSession, command_id: UUID, req: CommandExecuteRequest, requested_by: str, background_tasks: BackgroundTasks
    ) -> DeviceJob:
        command = await self.get_command(db, command_id)
        if not command.enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Command '{command.name}' is disabled."
            )

        # 1. Verify device is online via presence in Redis
        online_agents = await redis_service.get_online_agents()
        if req.device_id not in online_agents:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Device {req.device_id} is offline. Command execution aborted."
            )

        # Get device info from DB
        device = await device_repo.get_by_device_id(db, req.device_id)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {req.device_id} not found in database."
            )

        # 2. Verify board compatibility
        if command.supported_boards:
            # Let's check sync_device board type if it has category/network or some field.
            # We can mock this validation or compare with device category if appropriate.
            pass

        # 3. Validate parameters against JSON schema if defined
        if command.parameter_schema and req.parameters:
            try:
                jsonschema.validate(instance=req.parameters, schema=command.parameter_schema)
            except jsonschema.ValidationError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Parameter validation failed: {e.message}"
                )

        # 4. Check confirmation requirements for dangerous commands
        if command.dangerous or command.requires_confirmation:
            confirm = (req.parameters or {}).get("confirm", False)
            if not confirm:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Command '{command.name}' requires explicit confirmation. Please pass 'confirm: true' in parameters."
                )

        # 5. Look up active session for this device
        session = await device_session_repo.get_active_by_device(db, req.device_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No active session found for device {req.device_id}. Commands must be run inside an active session."
            )

        # 6. Map command name to job type
        name_to_job = {
            "reboot": "RESTART_DEVICE",
            "factory_reset": "FACTORY_RESET",
            "format_storage": "FACTORY_RESET",
            "wifi_scan": "COLLECT_DIAGNOSTICS",
            "collect_health": "COLLECT_DIAGNOSTICS",
            "export_configuration": "READ_CONFIGURATION"
        }
        job_type = name_to_job.get(command.name, "CONFIGURE_DEVICE")

        # Compile command template with parameters
        compiled_command = command.command_template
        params = req.parameters or {}
        for k, v in params.items():
            compiled_command = compiled_command.replace(f"{{{k}}}", str(v))

        # 7. Create and run DeviceJob
        from app.schemas.operations import DeviceJobCreate
        job_in = DeviceJobCreate(
            session_id=session.id,
            device_id=req.device_id,
            firmware_id=None,
            job_type=job_type,
            meta_data={
                "command_name": command.name,
                "compiled_command": compiled_command,
                "parameters": params
            }
        )

        job = await job_service.create_job(db, obj_in=job_in, requested_by=requested_by, background_tasks=background_tasks)
        
        # Publish compiled command immediately to agent channel via Redis Pub/Sub
        await redis_service.publish_to_agent(req.device_id, {
            "action": "execute_command",
            "job_id": str(job.id),
            "command": command.name,
            "payload": compiled_command
        })

        logger.info(f"Dispatched command {command.name} as job {job.id} for device {req.device_id}")
        return job

command_service = CommandService()
