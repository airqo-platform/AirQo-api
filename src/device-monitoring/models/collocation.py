from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Union

from helpers.exceptions import CollocationError


class CollocationBatchStatus(Enum):
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"

    @staticmethod
    def get_status(value):
        try:
            return CollocationBatchStatus[value]
        except Exception as ex:
            print(ex)
            return CollocationBatchStatus.RUNNING


class CollocationDeviceStatus(Enum):
    ERROR = "ERROR"
    FAILED = "FAILED"
    PASSED = "PASSED"
    RUNNING = "RUNNING"
    SCHEDULED = "SCHEDULED"


@dataclass
class DataCompleteness:
    device_name: str
    expected: int
    actual: int
    completeness: float
    missing: float
    passed: bool


@dataclass
class IntraSensorCorrelation:
    device_name: str
    pm2_5_pearson: Union[float, None]
    pm10_pearson: Union[float, None]
    pm2_5_r2: Union[float, None]
    pm10_r2: Union[float, None]
    passed: bool


@dataclass
class BaseResult:
    results: list[dict]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class DataCompletenessResult:
    results: list[DataCompleteness]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class IntraSensorCorrelationResult:
    results: list[IntraSensorCorrelation]
    passed_devices: list[str]
    failed_devices: list[str]
    error_devices: list[str]
    errors: list[str]


@dataclass
class CollocationBatchResultSummary:
    device: str
    status: CollocationDeviceStatus

    def to_dict(self):
        data = asdict(self)
        data["status"] = self.status.value
        return data


@dataclass
class CollocationBatchResult:
    data_completeness: DataCompletenessResult
    statistics: list
    differences: BaseResult
    intra_sensor_correlation: IntraSensorCorrelationResult
    inter_sensor_correlation: BaseResult
    data_source: str
    errors: list[str]

    def to_dict(self):
        return asdict(self)

    @staticmethod
    def empty_results():
        return CollocationBatchResult(
            data_completeness=DataCompletenessResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            statistics=[],
            differences=BaseResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            intra_sensor_correlation=IntraSensorCorrelationResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            inter_sensor_correlation=BaseResult(
                failed_devices=[],
                passed_devices=[],
                errors=[],
                results=[],
                error_devices=[],
            ),
            data_source="",
            errors=[],
        )


class DeviceStatusSummaryType(Enum):
    DATA_COMPLETENESS = "DATA_COMPLETENESS"
    INTRA_SENSOR_CORRELATION = "INTRA_SENSOR_CORRELATION"
    INTER_SENSOR_CORRELATION = "INTER_SENSOR_CORRELATION"
    DIFFERENCES = "DIFFERENCES"


@dataclass
class DeviceStatusSummary:
    title: str
    description: str
    status: str
    action: str
    extra_message: str
    type: str


@dataclass
class CollocationBatch:
    batch_id: str
    batch_name: str
    devices: list
    base_device: str

    start_date: datetime
    end_date: datetime
    date_created: datetime

    expected_hourly_records: int
    inter_correlation_threshold: float
    intra_correlation_threshold: float
    inter_correlation_r2_threshold: float
    intra_correlation_r2_threshold: float
    data_completeness_threshold: float
    differences_threshold: int

    data_completeness_parameter: str
    inter_correlation_parameter: str
    intra_correlation_parameter: str
    differences_parameter: str

    inter_correlation_additional_parameters: list[str]

    created_by: dict

    status: CollocationBatchStatus
    results: CollocationBatchResult
    errors: list[str]

    @staticmethod
    def valid_ranges():
        return [
            {
                "parameter": "data_completeness_threshold",
                "minimum_value": 1,
                "maximum_value": 100,
                "error_message": "Data completeness threshold should range from 0 to 1",
            },
            {
                "parameter": "intra_correlation_threshold",
                "minimum_value": 0,
                "maximum_value": 1,
                "error_message": "Intra correlation threshold should range from 0 to 1",
            },
            {
                "parameter": "inter_correlation_threshold",
                "minimum_value": 0,
                "maximum_value": 1,
                "error_message": "Inter correlation threshold should range from 0 to 1",
            },
            {
                "parameter": "intra_correlation_r2_threshold",
                "minimum_value": 0,
                "maximum_value": 1,
                "error_message": "Intra R2 correlation threshold should range from 0 to 1",
            },
            {
                "parameter": "inter_correlation_r2_threshold",
                "minimum_value": 0,
                "maximum_value": 1,
                "error_message": "Inter R2 correlation threshold should range from 0 to 1",
            },
            {
                "parameter": "differences_threshold",
                "minimum_value": 0,
                "maximum_value": 5,
                "error_message": "Differences threshold should be greater than 0",
            },
            {
                "parameter": "expected_hourly_records",
                "minimum_value": 0,
                "maximum_value": float("inf"),
                "error_message": "Expected records per hour should be greater than 0",
            },
        ]

    def to_dict(self):
        data = asdict(self)
        data["status"] = self.status.value
        return data

    def validate(self, raise_exception=True) -> bool:
        errors = []

        if self.end_date <= self.start_date:
            errors.append("End date must be greater than the start date")

        try:
            self.data_completeness_threshold = float(self.data_completeness_threshold)
        except (ValueError, TypeError):
            errors.append(
                f"Data completeness: {self.data_completeness_threshold} is not a valid float."
            )

        try:
            self.intra_correlation_threshold = float(self.intra_correlation_threshold)
        except (ValueError, TypeError):
            errors.append(
                f"Intra correlation threshold: {self.intra_correlation_threshold} is not a valid float."
            )

        try:
            self.inter_correlation_threshold = float(self.inter_correlation_threshold)
        except (ValueError, TypeError):
            errors.append(
                f"Inter correlation threshold: {self.inter_correlation_threshold} is not a valid float."
            )

        try:
            self.intra_correlation_r2_threshold = float(
                self.intra_correlation_r2_threshold
            )
        except (ValueError, TypeError):
            errors.append(
                f"Intra R2 correlation threshold: {self.intra_correlation_r2_threshold} is not a valid float."
            )

        try:
            self.inter_correlation_r2_threshold = float(
                self.inter_correlation_r2_threshold
            )
        except (ValueError, TypeError):
            errors.append(
                f"Inter R2 correlation threshold: {self.inter_correlation_r2_threshold} is not a valid float."
            )

        try:
            self.differences_threshold = int(self.differences_threshold)
        except (ValueError, TypeError):
            errors.append(
                f"Differences threshold: {self.differences_threshold} is not a valid integer."
            )

        try:
            self.expected_hourly_records = int(self.expected_hourly_records)
        except (ValueError, TypeError):
            errors.append(
                f"Expected hourly records: {self.expected_hourly_records} is not a valid integer."
            )

        if len(errors) != 0:
            if raise_exception:
                raise CollocationError(", ".join(errors))
            return False

        for parameter_range in self.valid_ranges():
            parameter = parameter_range["parameter"]
            minimum_value = parameter_range["minimum_value"]
            maximum_value = parameter_range["maximum_value"]
            error_message = parameter_range["error_message"]

            if parameter == "data_completeness_threshold":
                if (
                    not maximum_value
                    >= self.data_completeness_threshold
                    >= minimum_value
                ):
                    errors.append(error_message)

            if parameter == "expected_hourly_records":
                if not maximum_value >= self.expected_hourly_records >= minimum_value:
                    errors.append(error_message)

            if parameter == "differences_threshold":
                if not maximum_value >= self.differences_threshold >= minimum_value:
                    errors.append(error_message)

            if parameter == "inter_correlation_r2_threshold":
                if (
                    not maximum_value
                    >= self.inter_correlation_r2_threshold
                    >= minimum_value
                ):
                    errors.append(error_message)

            if parameter == "intra_correlation_r2_threshold":
                if (
                    not maximum_value
                    >= self.intra_correlation_r2_threshold
                    >= minimum_value
                ):
                    errors.append(error_message)

            if parameter == "inter_correlation_threshold":
                if (
                    not maximum_value
                    >= self.inter_correlation_threshold
                    >= minimum_value
                ):
                    errors.append(error_message)

            if parameter == "intra_correlation_threshold":
                if (
                    not maximum_value
                    >= self.intra_correlation_threshold
                    >= minimum_value
                ):
                    errors.append(error_message)

        if len(self.devices) < 1:
            errors.append("Devices cannot be empty")
        is_valid = len(errors) == 0

        if not is_valid and raise_exception:
            raise CollocationError(", ".join(errors))

        return is_valid

    def to_api_output(self):
        data = self.to_dict()
        data["summary"] = [row.to_dict() for row in self.get_summary()]
        return data

    def logical_end_date(self) -> datetime:
        return self.end_date + timedelta(minutes=90)

    def get_passed_devices(self) -> list:
        passed_devices = (
            set(self.results.data_completeness.passed_devices)
            .intersection(set(self.results.intra_sensor_correlation.passed_devices))
            .intersection(set(self.results.inter_sensor_correlation.passed_devices))
            .intersection(set(self.results.differences.passed_devices))
        )
        return list(passed_devices)

    def get_failed_devices(self) -> list:
        failed_devices = set(self.results.data_completeness.failed_devices)
        failed_devices.update(self.results.intra_sensor_correlation.failed_devices)
        failed_devices.update(self.results.inter_sensor_correlation.failed_devices)
        failed_devices.update(self.results.differences.failed_devices)
        return list(failed_devices)

    def get_error_devices(self) -> list:
        error_devices = (
            set(self.results.data_completeness.error_devices)
            .intersection(set(self.results.intra_sensor_correlation.error_devices))
            .intersection(set(self.results.inter_sensor_correlation.error_devices))
            .intersection(set(self.results.differences.error_devices))
        )
        return list(error_devices)

    def get_summary(self) -> list[CollocationBatchResultSummary]:
        if self.status == CollocationBatchStatus.SCHEDULED:
            return [
                CollocationBatchResultSummary(
                    device=device, status=CollocationDeviceStatus.SCHEDULED
                )
                for device in self.devices
            ]

        if self.status == CollocationBatchStatus.RUNNING:
            return [
                CollocationBatchResultSummary(
                    device=device, status=CollocationDeviceStatus.RUNNING
                )
                for device in self.devices
            ]

        summary: list[CollocationBatchResultSummary] = []
        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.PASSED
            )
            for device in self.get_passed_devices()
        )
        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.FAILED
            )
            for device in self.get_failed_devices()
        )

        summary.extend(
            CollocationBatchResultSummary(
                device=device, status=CollocationDeviceStatus.ERROR
            )
            for device in self.get_error_devices()
        )

        return summary

    def has_results(self) -> bool:
        data_completeness = list(self.results.data_completeness.error_devices)
        data_completeness.extend(self.results.data_completeness.passed_devices)
        data_completeness.extend(self.results.data_completeness.failed_devices)

        inter_sensor_correlation = list(
            self.results.inter_sensor_correlation.error_devices
        )
        inter_sensor_correlation.extend(
            self.results.inter_sensor_correlation.passed_devices
        )
        inter_sensor_correlation.extend(
            self.results.inter_sensor_correlation.failed_devices
        )

        intra_sensor_correlation = list(
            self.results.intra_sensor_correlation.error_devices
        )
        intra_sensor_correlation.extend(
            self.results.intra_sensor_correlation.passed_devices
        )
        intra_sensor_correlation.extend(
            self.results.intra_sensor_correlation.failed_devices
        )

        differences = list(self.results.differences.error_devices)
        differences.extend(self.results.differences.passed_devices)
        differences.extend(self.results.differences.failed_devices)

        return (
            len(differences) != 0
            and len(inter_sensor_correlation) != 0
            and len(intra_sensor_correlation) != 0
            and len(data_completeness) != 0
        )

    def set_status(self):
        now = datetime.utcnow()
        if now < self.start_date:
            self.status = CollocationBatchStatus.SCHEDULED
        elif now >= self.logical_end_date() and self.has_results():
            self.status = CollocationBatchStatus.COMPLETED
        else:
            self.status = CollocationBatchStatus.RUNNING

    def get_devices_status_summary(self) -> dict[str, list[DeviceStatusSummary]]:
        status_summary: dict[str, list[DeviceStatusSummary]] = {}

        for device in self.devices:
            status_summary[device] = []

        for device_result in self.results.data_completeness.results:
            description = (
                f"Data completeness was {round(device_result.completeness * 100, 2)}%. "
                f"Acceptable percentage was set to {self.data_completeness_threshold * 100}%. "
                f"A minimum of {device_result.expected} records are expected. "
                f"Device sent {device_result.actual} records. "
            )
            if device_result.passed:
                title = "Meets recommended data completeness"
                status = "PASSED"
                action = "All good"
                extra_message = "Meets recommended data completeness"
            else:
                title = "Doesn't  meet recommended data completeness"
                status = "FAILED"
                action = "Adjust completeness threshold"
                extra_message = "Doesn't  meet recommended data completeness"

            status_summary[device_result.device_name].append(
                DeviceStatusSummary(
                    title=title,
                    description=description,
                    status=status,
                    action=action,
                    extra_message=extra_message,
                    type=DeviceStatusSummaryType.DATA_COMPLETENESS.value,
                )
            )

        for device_result in self.results.intra_sensor_correlation.results:
            description = (
                f"PM2.5 pearson correlation was {device_result.pm2_5_pearson}. "
                f"Acceptable sensor to sensor correlation threshold was set to ≥ {self.intra_correlation_threshold} "
                f"and R2 ≥ {self.intra_correlation_r2_threshold} "
            )
            if device_result.passed:
                title = "Meets recommended sensor to sensor correlation"
                status = "PASSED"
                action = "All good"
                extra_message = "Meets recommended sensor to sensor correlation"
            else:
                title = "Doesn't meet recommended sensor to sensor correlation"
                status = "FAILED"
                action = "Adjust Correlation threshold"
                extra_message = "Doesn't  meet recommended sensor to sensor correlation"

            status_summary[device_result.device_name].append(
                DeviceStatusSummary(
                    title=title,
                    description=description,
                    status=status,
                    action=action,
                    extra_message=extra_message,
                    type=DeviceStatusSummaryType.INTRA_SENSOR_CORRELATION.value,
                )
            )

        for device in self.results.inter_sensor_correlation.passed_devices:
            status_summary[device].append(
                DeviceStatusSummary(
                    title=f"Meets recommended device to device correlation",
                    description=f"Acceptable device to device correlation threshold was set to ≥ {self.inter_correlation_threshold} and R2 ≥ {self.inter_correlation_r2_threshold}",
                    status="PASSED",
                    action="All good",
                    extra_message="Meets recommended device to device correlation",
                    type=DeviceStatusSummaryType.INTER_SENSOR_CORRELATION.value,
                )
            )

        for device in self.results.differences.passed_devices:
            status_summary[device].append(
                DeviceStatusSummary(
                    title=f"Meets recommended differences threshold",
                    description=f"Acceptable device to device differences threshold was set to ≤ {self.differences_threshold}",
                    status="PASSED",
                    action="All good",
                    extra_message="Meets recommended differences threshold",
                    type=DeviceStatusSummaryType.DIFFERENCES.value,
                )
            )

        failed_inter_sensor_correlation = set(
            self.results.inter_sensor_correlation.failed_devices
        )
        failed_inter_sensor_correlation.update(
            set(self.results.inter_sensor_correlation.error_devices)
        )

        failed_differences = set(self.results.differences.failed_devices)
        failed_differences.update(set(self.results.differences.error_devices))

        for device in failed_inter_sensor_correlation:
            status_summary[device].append(
                DeviceStatusSummary(
                    title=f"Doesn’t meet recommended device to device correlation",
                    description=f"Acceptable device to device correlation was set to ≥ {self.inter_correlation_threshold} and R2 ≥ {self.inter_correlation_r2_threshold}",
                    status="FAILED",
                    action="Adjust Correlation threshold",
                    extra_message="Doesn’t meet recommended device to device correlation",
                    type=DeviceStatusSummaryType.INTER_SENSOR_CORRELATION.value,
                )
            )

        for device in failed_differences:
            status_summary[device].append(
                DeviceStatusSummary(
                    title=f"Exceeds recommended differences threshold",
                    description=f"Acceptable device to device differences was set to ≤ {self.differences_threshold}",
                    status="FAILED",
                    action="Adjust differences threshold",
                    extra_message="Exceeds recommended differences threshold",
                    type=DeviceStatusSummaryType.DIFFERENCES.value,
                )
            )

        return status_summary


@dataclass
class IntraSensorData:
    device_name: str
    pm2_5_pearson: float
    pm10_pearson: float
    pm2_5_r2: float
    pm10_r2: float
    passed: bool
    timestamp: datetime

    def to_dict(self):
        return asdict(self)


@dataclass
class CollocationSummary:
    batch_id: str
    batch_name: str
    device_name: str
    added_by: str
    start_date: datetime
    end_date: datetime
    status: str
    date_added: datetime
    status_summary: list[DeviceStatusSummary]
