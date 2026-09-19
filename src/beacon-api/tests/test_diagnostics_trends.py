import unittest
from datetime import date, timedelta

from app.services.diagnostics.evaluator import DiagnosticEvaluator
from app.services.diagnostics.narrative import build_headline, build_summary
from app.services.diagnostics.profile_model import build_model
from app.services.diagnostics.trends import compute_trends, describe_trend, trend_issues
from tests.diagnostics_fixtures import healthy_pm, lowcost_profile, make_records

START = date(2026, 9, 1)


def _cycle(minimum, mean=None, hours_low=0.0):
    return {
        "metric": "battery_voltage", "unit": "V", "expected_min": 3.0, "expected_max": 4.3,
        "min": minimum, "mean": mean if mean is not None else minimum + 0.3, "hours_low_charge": hours_low,
    }


def _rows(values, build, component="device_battery", group="charge_cycle", score=100.0, start=START, step=1):
    return [
        (start + timedelta(days=i * step), {component: {group: build(v)}}, score)
        for i, v in enumerate(values)
    ]


def _find(trends, component, group, field):
    return next((t for t in trends if (t["component"], t["group"], t["field"]) == (component, group, field)), None)


class TestTrends(unittest.TestCase):
    def setUp(self):
        self.model = build_model(lowcost_profile())

    def test_falling_daily_minimum_is_degrading_with_projection(self):
        rows = _rows([3.95, 3.88, 3.80, 3.71, 3.64, 3.55, 3.48], _cycle)
        trend = _find(compute_trends(rows, self.model), "device_battery", "charge_cycle", "min")

        self.assertEqual(trend["status"], "degrading")
        self.assertEqual(trend["direction"], "down")
        self.assertEqual(trend["points"], 7)
        self.assertAlmostEqual(trend["slope_per_day"], -0.079, places=2)
        self.assertGreater(trend["r_squared"], 0.98)
        self.assertAlmostEqual(trend["change_fraction"], 0.47 / 1.3, places=1)   # judged against the 3.0–4.3 V range
        self.assertAlmostEqual(trend["days_to_limit"], (3.48 - 3.0) / 0.079, delta=0.6)
        self.assertEqual(trend["title"], "Battery Voltage daily minimum falling")
        self.assertIn("reaches the 3 V limit in about", describe_trend(trend))

    def test_degrading_trend_becomes_an_issue(self):
        rows = _rows([3.95, 3.88, 3.80, 3.71, 3.64, 3.55, 3.48], _cycle)
        issues = trend_issues(compute_trends(rows, self.model), self.model)
        issue = next(i for i in issues if i["code"] == "DEGRADING_TREND:device_battery.charge_cycle.min")

        self.assertEqual(issue["check"], "DEGRADING_TREND")
        self.assertEqual(issue["subsystem"], "battery")
        self.assertEqual(issue["component_name"], "device_battery")
        self.assertIn(issue["severity"], ("HIGH", "CRITICAL"))   # criticality 0.7 x confidence ~0.9
        self.assertIn("fell from 3.95 to 3.48 V", issue["description"])

    def test_noise_without_direction_is_stable(self):
        rows = _rows([3.80, 3.95, 3.78, 3.92, 3.81, 3.94, 3.79], _cycle)
        trend = _find(compute_trends(rows, self.model), "device_battery", "charge_cycle", "min")
        self.assertEqual(trend["status"], "stable")
        self.assertEqual(trend_issues([trend], self.model), [])

    def test_small_consistent_change_is_stable(self):
        rows = _rows([3.90, 3.89, 3.88, 3.87, 3.86, 3.85, 3.84], _cycle)   # 0.06 V over the window: under 15% of range
        trend = _find(compute_trends(rows, self.model), "device_battery", "charge_cycle", "min")
        self.assertEqual(trend["status"], "stable")

    def test_recovery_is_improving_and_not_an_issue(self):
        rows = _rows([3.40, 3.52, 3.63, 3.75, 3.86, 3.98], _cycle)
        trends = compute_trends(rows, self.model)
        self.assertEqual(_find(trends, "device_battery", "charge_cycle", "min")["status"], "improving")
        self.assertFalse(any(i["metric"] == "min" for i in trend_issues(trends, self.model)))

    def test_needs_enough_recent_days(self):
        self.assertEqual(compute_trends(_rows([3.9, 3.8, 3.7, 3.6], _cycle), self.model), [])   # 4 days: chance fits too easily
        five = compute_trends(_rows([3.9, 3.8, 3.7, 3.6, 3.5], _cycle), self.model)
        self.assertEqual(_find(five, "device_battery", "charge_cycle", "min")["status"], "degrading")
        # 4 points, but spread over 12 days: only those inside the 7-day window count
        sparse = _rows([3.9, 3.7, 3.5, 3.3], _cycle, step=4)
        self.assertIsNone(_find(compute_trends(sparse, self.model), "device_battery", "charge_cycle", "min"))
        # The newest day lacks the indicator (no battery readings that day): no trend is claimed for it
        rows = _rows([3.9, 3.8, 3.7, 3.6], _cycle) + [(START + timedelta(days=4), {}, 100.0)]
        self.assertIsNone(_find(compute_trends(rows, self.model), "device_battery", "charge_cycle", "min"))

    def test_sensor_pair_trends_follow_error_relative_to_the_level(self):
        def agreement(level, relative):
            # absolute error scales with the level; only the relative error says whether the pair is drifting
            return {"metric": "pm2_5_sensor1", "other_metric": "pm2_5_sensor2", "mean_level": level,
                    "mean_abs_error": level * relative, "bias": -level * relative,
                    "relative_error": relative, "relative_bias": -relative, "correlation": 0.95}

        def rows(pairs):
            return _rows(pairs, lambda p: agreement(*p), "pm_sensor1", "agreement:pm_sensor2")

        # Pollution triples over the week, the sensors stay 10% apart: absolute error triples, nothing is drifting
        ambient = compute_trends(rows([(20, 0.10), (28, 0.10), (36, 0.11), (44, 0.10), (52, 0.10), (60, 0.10)]), self.model)
        self.assertEqual(_find(ambient, "pm_sensor1", "agreement:pm_sensor2", "relative_error")["status"], "stable")
        self.assertIsNone(_find(ambient, "pm_sensor1", "agreement:pm_sensor2", "mean_abs_error"))

        # Same level every day, the gap widens from 10% to 30%
        drifting = compute_trends(rows([(30, 0.10), (30, 0.14), (30, 0.18), (30, 0.22), (30, 0.26), (30, 0.30)]), self.model)
        error = _find(drifting, "pm_sensor1", "agreement:pm_sensor2", "relative_error")
        self.assertEqual(error["status"], "degrading")
        self.assertAlmostEqual(error["change_fraction"], 0.20, places=2)
        self.assertEqual(error["title"], "Error against pm_sensor2 growing")
        # bias is followed by magnitude, so a bias growing more negative is also degrading
        self.assertEqual(_find(drifting, "pm_sensor1", "agreement:pm_sensor2", "relative_bias")["status"], "degrading")

    def test_limit_is_only_projected_within_the_horizon(self):
        # Degrading, but ~23 days from the limit at this slope: too far for a 7-day fit to forecast
        rows = _rows([4.20, 4.16, 4.12, 4.07, 4.03, 3.99, 3.95], _cycle)
        trend = _find(compute_trends(rows, self.model), "device_battery", "charge_cycle", "min")
        self.assertEqual(trend["status"], "degrading")
        self.assertIsNone(trend["days_to_limit"])
        self.assertNotIn("reaches the", describe_trend(trend))

    def test_health_score_trend_is_a_device_level_issue(self):
        rows = [(START + timedelta(days=i), {}, score) for i, score in enumerate([96, 90, 83, 77, 70, 64])]
        issues = trend_issues(compute_trends(rows, self.model), self.model)
        self.assertEqual([i["code"] for i in issues], ["DEGRADING_TREND:device.health.overall_health_score"])
        self.assertEqual(issues[0]["subsystem"], "device")

    def test_trend_check_can_be_disabled_per_component(self):
        profile = lowcost_profile()
        profile["components"][0]["meta_data"] = {"diagnostics": {"disabled_checks": ["DEGRADING_TREND"]}}
        model = build_model(profile)
        rows = _rows([3.95, 3.88, 3.80, 3.71, 3.64, 3.55, 3.48], _cycle)
        self.assertEqual(trend_issues(compute_trends(rows, model), model), [])

    def test_trend_policy_is_validated(self):
        profile = lowcost_profile()
        profile["meta_data"] = {"diagnostics": {"trend": {"degrade_lifecycle": "yes", "min_r_squared": 1.2, "window_days": 0}}}
        errors = " | ".join(build_model(profile).errors)
        self.assertIn("'meta_data.diagnostics.trend.degrade_lifecycle' must be true or false", errors)
        self.assertIn("'meta_data.diagnostics.trend.min_r_squared' must be between 0 and 1", errors)
        self.assertIn("'meta_data.diagnostics.trend.window_days' must be greater than 0", errors)

        profile["meta_data"] = {"diagnostics": {"trend": {"degrade_lifecycle": False, "window_days": 14}}}
        model = build_model(profile)
        self.assertTrue(model.diagnosable)
        self.assertEqual(model.policy["trend"]["window_days"], 14)


class TestNarrative(unittest.TestCase):
    def setUp(self):
        self.evaluator = DiagnosticEvaluator()
        self.model = build_model(lowcost_profile())

    def test_healthy_day(self):
        result = self.evaluator.evaluate_telemetry("dev_ok", make_records(180), profile=lowcost_profile())
        self.assertEqual(result["headline"], "Healthy (100/100)")
        summary = result["summary"]
        self.assertIn("Battery Voltage ranged 4–4.04 V", summary)
        self.assertIn("with no outages.", summary)
        self.assertIn("Sensor 1 PM2.5 and Sensor 2 PM2.5 agree (r=1, mean error 0.5 ug/m3", summary)
        self.assertIn("100% of readings within tolerance", summary)
        self.assertIn("No issues detected.", summary)
        self.assertNotIn("Recommended:", summary)

    def test_power_related_outage_day(self):
        base = 1700000000
        records = [
            {"datetime": base + i * 120, "battery_voltage": 3.8 - 0.7 * i / 59, "pm2_5_sensor1": 20.0 + i % 5,
             "pm2_5_sensor2": 20.5 + i % 5}
            for i in range(60)
        ] + [
            {"datetime": base + 60 * 120 + 4 * 3600 + i * 120, "battery_voltage": 3.9, "pm2_5_sensor1": 20.0 + i % 5,
             "pm2_5_sensor2": 20.5 + i % 5}
            for i in range(60)
        ]
        result = self.evaluator.evaluate_telemetry("dev_out", records, profile=lowcost_profile())
        self.assertIn("device_battery (battery) fault", result["headline"])
        summary = result["summary"]
        self.assertIn("1 outage totalling 4 h (longest 4 h), after battery voltage dropped below 3.39, which points to power", summary)
        self.assertIn("Issues: ", summary)
        self.assertIn("Recommended: Inspect device_battery (battery)", summary)

    def test_link_related_outage_and_disagreement(self):
        base = 1700000000
        records = [
            {"datetime": base + (i if i < 60 else i + 120) * 120, "battery_voltage": 4.0 + 0.01 * (i % 3),
             "pm2_5_sensor1": healthy_pm(i), "pm2_5_sensor2": healthy_pm(i) + 9.0}
            for i in range(120)
        ]
        summary = self.evaluator.evaluate_telemetry("dev_link", records, profile=lowcost_profile())["summary"]
        self.assertIn("with a healthy battery voltage, which points to the link rather than power", summary)
        self.assertIn("Sensor 1 PM2.5 and Sensor 2 PM2.5 disagree", summary)
        self.assertIn("Sensor 1 PM2.5 reads 9 ug/m3 lower", summary)
        self.assertIn("0% of readings within tolerance", summary)

    def test_streaks_resolutions_and_trends(self):
        result = self.evaluator.evaluate_telemetry("dev_ok", make_records(180), profile=lowcost_profile())
        rows = _rows([3.95, 3.88, 3.80, 3.71, 3.64, 3.55, 3.48], _cycle) + _rows(
            [6.0, 5.0, 4.0, 3.0, 2.0, 1.0, 0.2], lambda h: {"offline_hours": h, "missing_rate": 0.1}, "communication", "coverage"
        )
        trends = compute_trends(rows, self.model)
        narrative = build_summary(
            {**result, "lifecycle_state": "DEGRADING"},
            self.model,
            issues=[
                {"title": "Battery Voltage daily minimum falling", "is_new": True, "streak_days": 1},
                {"title": "Data gaps", "is_new": False, "streak_days": 4},
            ],
            resolved_titles=["Sensor 1 PM2.5 stuck at a constant value"],
            trends=trends,
        )
        self.assertEqual(narrative["headline"], "Degrading (100/100)")
        summary = narrative["summary"]
        self.assertIn("New today: Battery Voltage daily minimum falling.", summary)
        self.assertIn("Persisting: Data gaps (day 4).", summary)
        self.assertIn("Resolved since the previous diagnosis: Sensor 1 PM2.5 stuck at a constant value.", summary)
        self.assertIn("Trend: Battery Voltage daily minimum fell from 3.95 to 3.48 V over 7 diagnosed days", summary)
        self.assertIn("Improving over the last days: offline time.", summary)

    def test_no_data(self):
        result = self.evaluator.evaluate_telemetry("dev_none", [], profile=lowcost_profile())
        self.assertEqual(result["headline"], "No data")
        self.assertEqual(result["summary"], "No readings were received in this window.")
        self.assertEqual(build_headline({"lifecycle_state": "FAILED", "overall_health_score": 12.4, "top_diagnoses": []}),
                         "Failed (12/100)")


if __name__ == "__main__":
    unittest.main()
