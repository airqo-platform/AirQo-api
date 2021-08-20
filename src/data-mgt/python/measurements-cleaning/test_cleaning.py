import json
import unittest

from clean import Clean


class MyTestCase(unittest.TestCase):

    def test_outliers(self):

        uncleaned_measurements = list([dict({
            "tenant": "airqo",
            "frequency": "row",
            "time": "2021-03-02T00:00:00Z",
            "device": "aq_01",
            "device_id": "JKSDJSJDSD",
            "site_id": "JKSDJSJDSD",
            "device_number": "1234",
            "location": dict({
                "latitude": "0.342",
                "longitude": "32.032",
            }),
            "internalTemperature": {
                "value": "0.732"
            },
            "internalHumidity": {
                "value": "0.234"
            },
            "externalTemperature": {
                "value": "0.783"
            },
            "externalHumidity": {
                "value": "0.783"
            },
            "externalPressure": {
                "value": "0.783"
            },
            "speed": {
                "value": "0.783"
            },
            "altitude": {
                "value": "0.783"
            },
            "battery": {
                "value": "0.783"
            },
            "satellites": {
                "value": "0.783"
            },
            "hdop": {
                "value": "0.783"
            },
            "pm10": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
            "pm2_5": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
            "no2": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
            "pm1": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
            "s2_pm10": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
            "s2_pm2_5": dict({
                "value": "0.783",
                "calibratedValue": "0.783",
                "uncertaintyValue": "0.783",
                "standardDeviationValue": "0.783"
            }),
        })])

        test_cases = ['pm2_5', 'pm10', 's2_pm2_5', 's2_pm10', 'externalTemperature', 'externalHumidity']
        for test_case in test_cases:

            print(test_case)
            upper_limit = '500.401'

            if test_case == 'externalTemperature':
                upper_limit = '45.01'

            if test_case == 'externalHumidity':
                upper_limit = '99.01'

            test_lower_limit = uncleaned_measurements.copy()
            test_lower_limit[0][f'{test_case}']['value'] = "-0.1"
            cleaning = Clean(test_lower_limit)
            cleaning.clean_measurements()
            cleaned_measurements = cleaning.get_cleaned_measurements()
            self.assertEqual(len(list(json.loads(cleaned_measurements))), 0)

            test_upper_limit = uncleaned_measurements.copy()
            test_upper_limit[0][f'{test_case}']['value'] = upper_limit
            cleaning = Clean(test_upper_limit)
            cleaning.clean_measurements()
            cleaned_measurements = cleaning.get_cleaned_measurements()
            self.assertEqual(len(list(json.loads(cleaned_measurements))), 0)

            test_lowest_value = uncleaned_measurements.copy()
            test_lowest_value[0][f'{test_case}']['value'] = "0.1"
            cleaning = Clean(test_lowest_value)
            cleaning.clean_measurements()
            cleaned_measurements = cleaning.get_cleaned_measurements()
            self.assertEqual(len(list(json.loads(cleaned_measurements))), 1)

            test_highest_value = uncleaned_measurements.copy()
            test_highest_value[0][f'{test_case}']['value'] = f'{float(upper_limit) - 1}'
            cleaning = Clean(test_highest_value)
            cleaning.clean_measurements()
            cleaned_measurements = cleaning.get_cleaned_measurements()
            self.assertEqual(len(list(json.loads(cleaned_measurements))), 1)


if __name__ == '__main__':
    unittest.main()
