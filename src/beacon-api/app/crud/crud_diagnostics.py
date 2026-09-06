import uuid
from typing import List, Optional, Dict, Any, Union
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.device_schema import DeviceProfile, ComponentDefinition, MetricDefinition, ComponentRelationship
from app.models.diagnostics import (
    DiagnosticTemplate,
    SymptomDefinition,
    CauseDefinition,
    DiagnosticHypothesisRule,
    ProfileDiagnosticTemplate,
)
from app.models.health import DeviceHealthSnapshot, DiagnosticFeedback
from app.schemas.device_schema import (
    DeviceProfileCreate,
    DeviceProfileUpdateSchema,
    ComponentDefinitionCreate,
    ComponentDefinitionUpdate,
)
from app.schemas.diagnostics import DiagnosticTemplateCreate, DiagnosticFeedbackCreate


class CRUDDiagnostics:
    # ── Device Profiles ───────────────────────────────────────────────────
    def get_profile(self, db: Session, profile_id: Union[UUID, str]) -> Optional[DeviceProfile]:
        if isinstance(profile_id, UUID):
            return db.query(DeviceProfile).filter(DeviceProfile.id == profile_id).first()
        if isinstance(profile_id, str):
            try:
                val_id = UUID(profile_id)
                p = db.query(DeviceProfile).filter(DeviceProfile.id == val_id).first()
                if p:
                    return p
            except (ValueError, AttributeError):
                pass
            return db.query(DeviceProfile).filter(DeviceProfile.name == profile_id).first()
        return db.query(DeviceProfile).filter(DeviceProfile.id == profile_id).first()

    def get_profile_by_name(self, db: Session, name: str) -> Optional[DeviceProfile]:
        return db.query(DeviceProfile).filter(DeviceProfile.name == name).first()

    def list_profiles(
        self, db: Session, skip: int = 0, limit: int = 100, category: Optional[str] = None, vendor_id: Optional[UUID] = None
    ) -> List[DeviceProfile]:
        query = db.query(DeviceProfile)
        if category:
            query = query.filter(DeviceProfile.category == category)
        if vendor_id:
            query = query.filter(DeviceProfile.vendor_id == vendor_id)
        return query.offset(skip).limit(limit).all()

    def create_profile(self, db: Session, obj_in: DeviceProfileCreate) -> DeviceProfile:
        db_obj = DeviceProfile(
            name=obj_in.name,
            category=obj_in.category,
            description=obj_in.description,
            vendor_id=obj_in.vendor_id,
            meta_data=obj_in.meta_data,
            telemetry_mappings=obj_in.telemetry_mappings or {},
            config_mappings=obj_in.config_mappings or {},
            metadata_mappings=obj_in.metadata_mappings or {},
        )
        db.add(db_obj)
        db.flush()

        if obj_in.components:
            for c_in in obj_in.components:
                c_meta = c_in.meta_data
                x_coord = c_in.x_coordinate
                y_coord = c_in.y_coordinate
                if x_coord is None and isinstance(c_meta, dict):
                    x_coord = c_meta.get("x_coordinate")
                if y_coord is None and isinstance(c_meta, dict):
                    y_coord = c_meta.get("y_coordinate")

                c_obj = ComponentDefinition(
                    profile_id=db_obj.id,
                    name=c_in.name,
                    component_type=c_in.component_type,
                    criticality=c_in.criticality,
                    x_coordinate=float(x_coord) if x_coord is not None else None,
                    y_coordinate=float(y_coord) if y_coord is not None else None,
                    meta_data=c_meta,
                )
                db.add(c_obj)
                db.flush()

                if c_in.metrics:
                    for m_in in c_in.metrics:
                        m_obj = MetricDefinition(
                            component_id=c_obj.id,
                            key=m_in.key,
                            unit=m_in.unit,
                            data_type=m_in.data_type,
                            expected_min=m_in.expected_min,
                            expected_max=m_in.expected_max,
                            max_rate_of_change=m_in.max_rate_of_change,
                            is_telemetry_field=m_in.is_telemetry_field,
                        )
                        db.add(m_obj)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update_profile(
        self, db: Session, db_obj: DeviceProfile, obj_in: DeviceProfileUpdateSchema
    ) -> DeviceProfile:
        # 1. Update Header & Metadata
        if obj_in.name is not None and obj_in.name != db_obj.name:
            existing = self.get_profile_by_name(db, obj_in.name)
            if existing and existing.id != db_obj.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"DeviceProfile with name '{obj_in.name}' already exists.",
                )
            db_obj.name = obj_in.name
        if obj_in.category is not None:
            db_obj.category = obj_in.category
        if obj_in.description is not None:
            db_obj.description = obj_in.description

        if obj_in.vendor_id is not None:
            if not obj_in.vendor_id:
                db_obj.vendor_id = None
            elif isinstance(obj_in.vendor_id, UUID):
                db_obj.vendor_id = obj_in.vendor_id
            else:
                try:
                    db_obj.vendor_id = UUID(str(obj_in.vendor_id))
                except (ValueError, TypeError):
                    v = db.query(Vendor).filter(Vendor.name.ilike(str(obj_in.vendor_id))).first()
                    db_obj.vendor_id = v.id if v else None
        elif obj_in.vendor is not None:
            if isinstance(obj_in.vendor, dict) and "id" in obj_in.vendor:
                try:
                    db_obj.vendor_id = UUID(str(obj_in.vendor["id"]))
                except (ValueError, TypeError):
                    pass
            elif isinstance(obj_in.vendor, str) and obj_in.vendor:
                try:
                    db_obj.vendor_id = UUID(obj_in.vendor)
                except (ValueError, TypeError):
                    v = db.query(Vendor).filter(Vendor.name.ilike(obj_in.vendor)).first()
                    if v:
                        db_obj.vendor_id = v.id
            elif obj_in.vendor is None:
                db_obj.vendor_id = None

        if obj_in.meta_data is not None:
            db_obj.meta_data = dict(obj_in.meta_data)

        # 2. Update Dynamic Ingestion Mappings (stored as JSON/dict)
        if obj_in.telemetry_mappings is not None:
            db_obj.telemetry_mappings = dict(obj_in.telemetry_mappings)
        if obj_in.config_mappings is not None:
            db_obj.config_mappings = dict(obj_in.config_mappings)
        if obj_in.metadata_mappings is not None:
            db_obj.metadata_mappings = dict(obj_in.metadata_mappings)

        # 3. Update Components & Relationships
        def _to_dict(item: Any) -> Dict[str, Any]:
            if isinstance(item, dict):
                return item
            if hasattr(item, "model_dump"):
                return item.model_dump()
            if hasattr(item, "dict"):
                return item.dict()
            return dict(item)

        if obj_in.relationships is not None:
            db_obj.relationships.clear()
            db.flush()

        if obj_in.components is not None:
            existing_by_id = {str(c.id): c for c in db_obj.components}
            existing_by_name = {c.name.lower(): c for c in db_obj.components}

            retained_components = []
            for raw_c in obj_in.components:
                c_data = _to_dict(raw_c)
                c_id = c_data.get("id")
                matched = None
                if c_id and str(c_id) in existing_by_id:
                    matched = existing_by_id[str(c_id)]
                elif c_data.get("name") and c_data.get("name").lower() in existing_by_name:
                    matched = existing_by_name[c_data.get("name").lower()]

                c_meta = c_data.get("meta_data") if "meta_data" in c_data else c_data.get("metadata")

                if matched:
                    if "name" in c_data and c_data["name"] is not None:
                        matched.name = c_data["name"]
                    if "component_type" in c_data and c_data["component_type"] is not None:
                        matched.component_type = c_data["component_type"]
                    if "criticality" in c_data and c_data["criticality"] is not None:
                        matched.criticality = float(c_data["criticality"])
                    if "x_coordinate" in c_data and c_data["x_coordinate"] is not None:
                        matched.x_coordinate = float(c_data["x_coordinate"])
                    elif isinstance(c_meta, dict) and "x_coordinate" in c_meta:
                        matched.x_coordinate = float(c_meta["x_coordinate"])
                    if "y_coordinate" in c_data and c_data["y_coordinate"] is not None:
                        matched.y_coordinate = float(c_data["y_coordinate"])
                    elif isinstance(c_meta, dict) and "y_coordinate" in c_meta:
                        matched.y_coordinate = float(c_meta["y_coordinate"])
                    if c_meta is not None:
                        matched.meta_data = c_meta

                    if "metrics" in c_data and c_data["metrics"] is not None:
                        matched.metrics.clear()
                        db.flush()
                        for raw_m in c_data["metrics"]:
                            m_data = _to_dict(raw_m)
                            m_obj = MetricDefinition(
                                component_id=matched.id,
                                key=m_data.get("key"),
                                unit=m_data.get("unit"),
                                data_type=m_data.get("data_type", "float"),
                                expected_min=m_data.get("expected_min"),
                                expected_max=m_data.get("expected_max"),
                                max_rate_of_change=m_data.get("max_rate_of_change"),
                                is_telemetry_field=m_data.get("is_telemetry_field", True),
                            )
                            matched.metrics.append(m_obj)
                    retained_components.append(matched)
                else:
                    new_id = uuid.uuid4()
                    if c_id:
                        try:
                            new_id = UUID(str(c_id))
                        except (ValueError, TypeError):
                            pass
                    x_coord = c_data.get("x_coordinate")
                    y_coord = c_data.get("y_coordinate")
                    if x_coord is None and isinstance(c_meta, dict):
                        x_coord = c_meta.get("x_coordinate")
                    if y_coord is None and isinstance(c_meta, dict):
                        y_coord = c_meta.get("y_coordinate")

                    new_comp = ComponentDefinition(
                        id=new_id,
                        profile_id=db_obj.id,
                        name=c_data.get("name", "unnamed_component"),
                        component_type=c_data.get("component_type", "sensor"),
                        criticality=float(c_data.get("criticality", 1.0)),
                        x_coordinate=float(x_coord) if x_coord is not None else None,
                        y_coordinate=float(y_coord) if y_coord is not None else None,
                        meta_data=c_meta,
                    )
                    db.add(new_comp)
                    db.flush()

                    if "metrics" in c_data and c_data["metrics"] is not None:
                        for raw_m in c_data["metrics"]:
                            m_data = _to_dict(raw_m)
                            m_obj = MetricDefinition(
                                component_id=new_comp.id,
                                key=m_data.get("key"),
                                unit=m_data.get("unit"),
                                data_type=m_data.get("data_type", "float"),
                                expected_min=m_data.get("expected_min"),
                                expected_max=m_data.get("expected_max"),
                                max_rate_of_change=m_data.get("max_rate_of_change"),
                                is_telemetry_field=m_data.get("is_telemetry_field", True),
                            )
                            new_comp.metrics.append(m_obj)
                    retained_components.append(new_comp)

            db_obj.components = retained_components
            db.flush()

            if obj_in.relationships is None:
                retained_ids = {c.id for c in db_obj.components}
                db_obj.relationships = [
                    r for r in db_obj.relationships
                    if r.source_component_id in retained_ids and r.target_component_id in retained_ids
                ]
                db.flush()

        if obj_in.relationships is not None:
            comp_map_by_id = {str(c.id): c.id for c in db_obj.components}
            comp_map_by_name = {c.name.lower(): c.id for c in db_obj.components}

            for raw_r in obj_in.relationships:
                r_data = _to_dict(raw_r)
                src_raw = r_data.get("source_component_id") or r_data.get("source") or r_data.get("source_component")
                tgt_raw = r_data.get("target_component_id") or r_data.get("target") or r_data.get("target_component")
                rel_type = r_data.get("relationship_type") or r_data.get("type", "POWERS")

                src_id = None
                if src_raw:
                    str_src = str(src_raw)
                    if str_src in comp_map_by_id:
                        src_id = comp_map_by_id[str_src]
                    elif str_src.lower() in comp_map_by_name:
                        src_id = comp_map_by_name[str_src.lower()]
                    else:
                        try:
                            src_id = UUID(str_src)
                        except (ValueError, TypeError):
                            pass

                tgt_id = None
                if tgt_raw:
                    str_tgt = str(tgt_raw)
                    if str_tgt in comp_map_by_id:
                        tgt_id = comp_map_by_id[str_tgt]
                    elif str_tgt.lower() in comp_map_by_name:
                        tgt_id = comp_map_by_name[str_tgt.lower()]
                    else:
                        try:
                            tgt_id = UUID(str_tgt)
                        except (ValueError, TypeError):
                            pass

                if src_id and tgt_id:
                    rel_obj = ComponentRelationship(
                        profile_id=db_obj.id,
                        source_component_id=src_id,
                        target_component_id=tgt_id,
                        relationship_type=rel_type,
                    )
                    db_obj.relationships.append(rel_obj)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete_profile(self, db: Session, db_obj: DeviceProfile) -> None:
        db.query(ProfileDiagnosticTemplate).filter(
            ProfileDiagnosticTemplate.profile_id == db_obj.id
        ).delete()
        db.delete(db_obj)
        db.commit()

    # ── Subsystem Components ──────────────────────────────────────────────
    def get_component(
        self, db: Session, profile_id: Union[UUID, str], component_id: Union[UUID, str]
    ) -> Optional[ComponentDefinition]:
        prof = self.get_profile(db, profile_id)
        if not prof:
            return None

        comp_uuid = None
        if isinstance(component_id, UUID):
            comp_uuid = component_id
        elif isinstance(component_id, str):
            try:
                comp_uuid = UUID(component_id)
            except (ValueError, TypeError):
                pass

        if comp_uuid:
            return (
                db.query(ComponentDefinition)
                .filter(
                    ComponentDefinition.profile_id == prof.id,
                    ComponentDefinition.id == comp_uuid,
                )
                .first()
            )
        return (
            db.query(ComponentDefinition)
            .filter(
                ComponentDefinition.profile_id == prof.id,
                ComponentDefinition.name.ilike(str(component_id)),
            )
            .first()
        )

    def list_components(
        self, db: Session, profile_id: Union[UUID, str]
    ) -> List[ComponentDefinition]:
        prof = self.get_profile(db, profile_id)
        if not prof:
            return []
        return (
            db.query(ComponentDefinition)
            .filter(ComponentDefinition.profile_id == prof.id)
            .all()
        )

    def create_component(
        self, db: Session, profile_id: Union[UUID, str], obj_in: ComponentDefinitionCreate
    ) -> ComponentDefinition:
        prof = self.get_profile(db, profile_id)
        if not prof:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device profile '{profile_id}' not found",
            )

        c_meta = obj_in.meta_data
        x_coord = obj_in.x_coordinate
        y_coord = obj_in.y_coordinate
        if x_coord is None and isinstance(c_meta, dict):
            x_coord = c_meta.get("x_coordinate")
        if y_coord is None and isinstance(c_meta, dict):
            y_coord = c_meta.get("y_coordinate")

        comp = ComponentDefinition(
            profile_id=prof.id,
            name=obj_in.name,
            component_type=obj_in.component_type,
            criticality=obj_in.criticality,
            x_coordinate=float(x_coord) if x_coord is not None else None,
            y_coordinate=float(y_coord) if y_coord is not None else None,
            meta_data=c_meta,
        )
        db.add(comp)
        db.flush()

        if obj_in.metrics:
            for m_in in obj_in.metrics:
                m_obj = MetricDefinition(
                    component_id=comp.id,
                    key=m_in.key,
                    unit=m_in.unit,
                    data_type=m_in.data_type,
                    expected_min=m_in.expected_min,
                    expected_max=m_in.expected_max,
                    max_rate_of_change=m_in.max_rate_of_change,
                    is_telemetry_field=m_in.is_telemetry_field,
                )
                db.add(m_obj)

        db.commit()
        db.refresh(comp)
        return comp

    def update_component(
        self, db: Session, db_obj: ComponentDefinition, obj_in: ComponentDefinitionUpdate
    ) -> ComponentDefinition:
        if obj_in.name is not None:
            db_obj.name = obj_in.name
        if obj_in.component_type is not None:
            db_obj.component_type = obj_in.component_type
        if obj_in.criticality is not None:
            db_obj.criticality = obj_in.criticality

        c_meta = obj_in.meta_data
        if obj_in.x_coordinate is not None:
            db_obj.x_coordinate = float(obj_in.x_coordinate)
        elif isinstance(c_meta, dict) and "x_coordinate" in c_meta:
            db_obj.x_coordinate = float(c_meta["x_coordinate"])

        if obj_in.y_coordinate is not None:
            db_obj.y_coordinate = float(obj_in.y_coordinate)
        elif isinstance(c_meta, dict) and "y_coordinate" in c_meta:
            db_obj.y_coordinate = float(c_meta["y_coordinate"])

        if c_meta is not None:
            db_obj.meta_data = c_meta

        if obj_in.metrics is not None:
            db_obj.metrics.clear()
            db.flush()
            for m_in in obj_in.metrics:
                m_obj = MetricDefinition(
                    component_id=db_obj.id,
                    key=m_in.key,
                    unit=m_in.unit,
                    data_type=m_in.data_type,
                    expected_min=m_in.expected_min,
                    expected_max=m_in.expected_max,
                    max_rate_of_change=m_in.max_rate_of_change,
                    is_telemetry_field=m_in.is_telemetry_field,
                )
                db_obj.metrics.append(m_obj)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete_component(self, db: Session, db_obj: ComponentDefinition) -> None:
        db.delete(db_obj)
        db.commit()

    # ── Diagnostic Templates ──────────────────────────────────────────────
    def get_template(self, db: Session, template_id: UUID) -> Optional[DiagnosticTemplate]:
        return db.query(DiagnosticTemplate).filter(DiagnosticTemplate.id == template_id).first()

    def list_templates(self, db: Session, skip: int = 0, limit: int = 100) -> List[DiagnosticTemplate]:
        return db.query(DiagnosticTemplate).offset(skip).limit(limit).all()

    def create_template(self, db: Session, obj_in: DiagnosticTemplateCreate) -> DiagnosticTemplate:
        db_obj = DiagnosticTemplate(
            name=obj_in.name,
            target_component_type=obj_in.target_component_type,
            description=obj_in.description,
            version=obj_in.version,
        )
        db.add(db_obj)
        db.flush()

        if obj_in.symptoms:
            for s_in in obj_in.symptoms:
                s_obj = SymptomDefinition(
                    template_id=db_obj.id,
                    code=s_in.code,
                    name=s_in.name,
                    severity=s_in.severity,
                    evaluation_logic=s_in.evaluation_logic,
                    description=s_in.description,
                )
                db.add(s_obj)

        if obj_in.causes:
            for c_in in obj_in.causes:
                c_obj = CauseDefinition(
                    template_id=db_obj.id,
                    code=c_in.code,
                    title=c_in.title,
                    category=c_in.category,
                    description=c_in.description,
                    recommended_action=c_in.recommended_action,
                )
                db.add(c_obj)
                db.flush()

                if c_in.hypothesis_rules:
                    for r_in in c_in.hypothesis_rules:
                        r_obj = DiagnosticHypothesisRule(
                            cause_id=c_obj.id,
                            evidence_code=r_in.evidence_code,
                            weight=r_in.weight,
                            is_mandatory=r_in.is_mandatory,
                            description=r_in.description,
                        )
                        db.add(r_obj)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    # ── Health Snapshots & Feedback ───────────────────────────────────────
    def get_latest_snapshot(self, db: Session, device_id: str) -> Optional[DeviceHealthSnapshot]:
        return (
            db.query(DeviceHealthSnapshot)
            .filter(DeviceHealthSnapshot.device_id == device_id)
            .order_by(DeviceHealthSnapshot.timestamp.desc())
            .first()
        )

    def get_snapshot_history(
        self, db: Session, device_id: str, limit: int = 50
    ) -> List[DeviceHealthSnapshot]:
        return (
            db.query(DeviceHealthSnapshot)
            .filter(DeviceHealthSnapshot.device_id == device_id)
            .order_by(DeviceHealthSnapshot.timestamp.desc())
            .limit(limit)
            .all()
        )

    def create_feedback(self, db: Session, obj_in: DiagnosticFeedbackCreate) -> DiagnosticFeedback:
        db_obj = DiagnosticFeedback(
            snapshot_id=obj_in.snapshot_id,
            device_id=obj_in.device_id,
            technician_user_id=obj_in.technician_user_id,
            confirmed_cause_code=obj_in.confirmed_cause_code,
            was_prediction_accurate=obj_in.was_prediction_accurate,
            actions_taken=obj_in.actions_taken,
            technician_notes=obj_in.technician_notes,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


crud_diagnostics = CRUDDiagnostics()
