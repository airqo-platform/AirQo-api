import unittest

from data import check_null, get_calibrated_value, get_value, flatten_json


class MyTestCase(unittest.TestCase):

    def test_flatten_json(self):
        measurement = {'_id': 'AirQo G508', 'channelID': 1351540, 'time': '2021-06-11T16:05:17.000Z',
                       'pm2_5': {'value': 43.35, 'calibratedValue': 43.707}, 's2_pm2_5': {'value': 44.07},
                       'pm10': {'value': 54.35}, 's2_pm10': {'value': 53.42}, 'frequency': 'minute',
                       'battery': {'value': 3.34}, 'location': {'latitude': {'value': 0.36521101}, 'longitude': {'value': 32.584919}},
                       'altitude': {'value': 1194}, 'speed': {'value': 0.02}, 'satellites': {'value': 12}, 'hdop': {'value': 69},
                       'internalTemperature': {'value': 32}, 'externalTemperature': None, 'internalHumidity': {'value': 35},
                       'externalHumidity': None, 'pm1': None, 'no2': None,
                       'deviceDetails': {'_id': '606d9da5032306001924b98b', 'mobility': False, 'height': 0,
                                         'name': 'AirQo G508', 'description': 'AirQo Generation 5 monitor Kampala Quality p/s',
                                         'visibility': True, 'product_name': 'AirQo Monitor', 'device_manufacturer': 'AirQo ', 'ISP': 'MTN',
                                         'channelID': 1351540, 'createdAt': '2021-04-07T11:55:18.008Z', 'updatedAt': '2021-04-23T11:28:33.058Z',
                                         'phoneNumber': 776481857, 'latitude': 0.36523899, 'longitude': 32.5849, 'isActive': True,
                                         'locationName': 'Kikaya, Kampala Uganda', 'siteName': 'Kikaya Bahai Area'}
                       }

        results = flatten_json(measurement)
        self.assertIn("s2_pm2_5", results)
        self.assertIn("s2_pm2_5_calibrate", results)
        self.assertIn("s2_pm10", results)
        self.assertIn("s2_pm10_calibrate", results)
        self.assertIn("pm2_5", results)
        self.assertIn("pm2_5_calibrate", results)
        self.assertIn("pm10", results)
        self.assertIn("pm10_calibrate", results)
        self.assertIn("internalTemperature", results)
        self.assertIn("internalTemperature_calibrate", results)
        self.assertIn("internalHumidity", results)
        self.assertIn("internalHumidity_calibrate", results)
        self.assertIn("externalTemperature", results)
        self.assertIn("externalTemperature_calibrate", results)
        self.assertIn("externalHumidity", results)
        self.assertIn("externalHumidity_calibrate", results)
        self.assertIn("s2_pm2_5", results)
        self.assertIn("hdop", results)
        self.assertIn("hdop_calibrate", results)
        self.assertIn("speed", results)
        self.assertIn("speed_calibrate", results)
        self.assertIn("no2", results)
        self.assertIn("no2_calibrate", results)
        self.assertIn("pm1", results)
        self.assertIn("pm1_calibrate", results)
        self.assertIn("altitude", results)
        self.assertIn("altitude_calibrate", results)
        self.assertIn("battery", results)
        self.assertIn("battery_calibrate", results)
        self.assertIn("satellites", results)
        self.assertIn("satellites_calibrate", results)

    def test_check_null(self):
        self.assertEqual(check_null(None), 0.0)
        self.assertEqual(check_null('None'), 0.0)
        self.assertEqual(check_null('Null'), 0.0)
        self.assertEqual(check_null('null'), 0.0)

    def test_get_value(self):
        self.assertIsNone(get_value(None))
        self.assertIsNone(get_value("value"))
        self.assertIsNone(get_value({"value": "string"}))
        self.assertIsNone(get_value({"calibratedValue": 0.2}))
        self.assertEqual(get_value({"value": "0.4"}), 0.4)
        self.assertEqual(get_value({"value": 34}), 34.0)

    def test_get_calibrated_value(self):

        self.assertIsNone(get_calibrated_value(None))
        self.assertIsNone(get_calibrated_value("calibratedValue"))
        self.assertIsNone(get_calibrated_value({"calibratedValue": "string"}))
        self.assertIsNone(get_calibrated_value({"value": 0.2}))
        self.assertEqual(get_calibrated_value({"calibratedValue": "0.4"}), 0.4)
        self.assertEqual(get_calibrated_value({"calibratedValue": 34}), 34.0)


if __name__ == '__main__':
    unittest.main()
