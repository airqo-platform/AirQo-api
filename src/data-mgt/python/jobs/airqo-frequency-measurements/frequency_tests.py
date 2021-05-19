import unittest
from datetime import datetime, timedelta
from calculate_measurements_by_frequency import get_frequency_value, get_measurements, check_null, compute_frequency, \
    add_to_events_collection


class MyTestCase(unittest.TestCase):

    def setUp(self) -> None:
        self.url = 'https://staging-platform.airqo.net/api/v1/'
        self.start_time = datetime.strftime(datetime.now() - timedelta(hours=24), '%Y-%m-%d')
        super().setUp()

    def test_get_frequency_value(self):

        sample = get_frequency_value('minute')
        self.assertEqual(sample, '1min')

        sample = get_frequency_value('HOURLY')
        self.assertEqual(sample, '60min')

        sample = get_frequency_value('Daily')
        self.assertEqual(sample, '1440min')

        sample = get_frequency_value('Weekly')
        self.assertEqual(sample, '10080min')

        sample = get_frequency_value('monThlY')
        self.assertEqual(sample, '43800min')

        self.assertRaises(Exception, get_frequency_value, 'hours')

    def test_get_measurements(self):

        measurements = get_measurements(self.start_time, self.url)
        self.assertIsNotNone(measurements)
        self.assertTrue(measurements)

        measurements = get_measurements(self.start_time, 'Invalid url')
        self.assertIsNotNone(measurements)
        self.assertFalse(measurements)

        measurements = get_measurements('Invalid date', self.url)
        self.assertIsNotNone(measurements)
        self.assertFalse(measurements)

    def test_check_null(self):
        value = check_null(None)
        self.assertEqual(value, 0)

        value = check_null('?')
        self.assertEqual(value, '?')

        value = check_null('Null')
        self.assertEqual(value, 0)

        value = check_null('null')
        self.assertEqual(value, 0)

    def test_compute_frequency(self):

        measurements = get_measurements(self.start_time, self.url)

        hourly_measurements = compute_frequency(measurements, 'minute')
        self.assertTrue(hourly_measurements)

        hourly_measurements = compute_frequency(measurements, 'hourly')
        self.assertTrue(hourly_measurements)

        hourly_measurements = compute_frequency(measurements, 'daily')
        self.assertTrue(hourly_measurements)

        hourly_measurements = compute_frequency(measurements, 'weekly')
        self.assertTrue(hourly_measurements)

        hourly_measurements = compute_frequency(measurements, 'monthly')
        self.assertTrue(hourly_measurements)

    def test_add_to_events_collection(self):
        self.assertRaises(Exception, add_to_events_collection, {'hello': 'world'})

        try:
            add_to_events_collection([{'device': 'hello world'}])
        except Exception as ex:
            self.fail(f"add_to_events_collection() raised {ex} unexpectedly!")


if __name__ == '__main__':
    unittest.main()
