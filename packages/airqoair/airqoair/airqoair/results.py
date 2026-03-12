from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd


@dataclass
class AirQoFigure:
    data: pd.DataFrame
    figure: Any
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def ax(self) -> Any:
        axes = getattr(self.figure, "axes", [])
        if not axes:
            raise ValueError("This AirQoFigure does not contain any matplotlib axes")
        return axes[0]

    @property
    def axes(self) -> list[Any]:
        axes = getattr(self.figure, "axes", [])
        return list(axes)

    def show(self) -> None:
        self.figure.show()

    def save(self, path: str | Path, **kwargs: Any) -> None:
        self.figure.savefig(path, bbox_inches="tight", **kwargs)


@dataclass
class AirQoMap:
    data: pd.DataFrame
    map: Any
    metadata: dict[str, Any] = field(default_factory=dict)

    def save(self, path: str | Path) -> None:
        self.map.save(str(path))


@dataclass
class AirQoReport:
    sections: dict[str, pd.DataFrame]
    metadata: dict[str, Any] = field(default_factory=dict)
    figure: Any | None = None

    def show(self) -> None:
        if self.figure is not None:
            self.figure.show()

    def save_figure(self, path: str | Path, **kwargs: Any) -> None:
        if self.figure is None:
            raise ValueError("This report does not have a figure")
        self.figure.savefig(path, bbox_inches="tight", **kwargs)

    def to_markdown(self) -> str:
        lines: list[str] = []
        title = self.metadata.get("title", "AirQo Report")
        lines.append(f"# {title}")
        pollutant = self.metadata.get("pollutant")
        statistic = self.metadata.get("statistic")
        condition_by = self.metadata.get("condition_by")
        if pollutant:
            lines.append("")
            lines.append(f"- Pollutant: `{pollutant}`")
        if statistic:
            lines.append(f"- Statistic: `{statistic}`")
        if condition_by:
            lines.append(f"- Conditioned By: `{condition_by}`")

        for name, table in self.sections.items():
            lines.append("")
            lines.append(f"## {name.replace('_', ' ').title()}")
            lines.append("")
            lines.append(_frame_to_markdown(table))

        return "\n".join(lines)

    def save_markdown(self, path: str | Path) -> None:
        Path(path).write_text(self.to_markdown(), encoding="utf-8")


def _frame_to_markdown(frame: pd.DataFrame) -> str:
    display = frame.copy()
    for column in display.columns:
        display[column] = display[column].map(_format_markdown_value)

    headers = [str(column) for column in display.columns]
    divider = ["---"] * len(headers)
    rows = ["| " + " | ".join(headers) + " |", "| " + " | ".join(divider) + " |"]

    for values in display.itertuples(index=False, name=None):
        rows.append("| " + " | ".join(str(value) for value in values) + " |")

    return "\n".join(rows)


def _format_markdown_value(value: Any) -> str:
    if pd.isna(value):
        return ""
    return str(value)
