import math
import unittest

from utils import convert_to_numeric, convert_to_tenant


class UtilsTestCase(unittest.TestCase):
    def test_convert_to_numeric(self):

        value = convert_to_numeric("@jj")
        self.assertTrue(math.isnan(value))

        value = convert_to_numeric("23")
        self.assertEqual(value, 23)

        value = convert_to_numeric("45.90")
        self.assertEqual(value, 45.90)

    def test_convert_to_tenant(self):

        value = convert_to_tenant("@jj")
        self.assertEqual(value, None)

        value = convert_to_tenant("KCCA")
        self.assertEqual(value, "kcca")

        value = convert_to_tenant("airQo")
        self.assertEqual(value, "airqo")


if __name__ == '__main__':
    unittest.main()
