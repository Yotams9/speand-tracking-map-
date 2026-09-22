"""Offline qualification checks; malformed-library acceptance is a recorded defect."""
import gzip
import unittest
from xml.etree import ElementTree as ET

from benchmark import gtin
from il_supermarket_parsers.utils.xml_utils import get_root_from_content


class Qualification(unittest.TestCase):
    def test_valid_gtin_and_leading_zero(self):
        self.assertTrue(gtin('4006381333931'))
        self.assertTrue(gtin('04006381333931'))

    def test_bad_checksum_and_non_ascii_fail(self):
        for value in ('4006381333932', '', '123', '４００６３８１３３３９３１'):
            self.assertFalse(gtin(value))

    def test_gzip_roundtrip(self):
        source = b'<Root><ItemCode>04006381333931</ItemCode></Root>'
        self.assertEqual(gzip.decompress(gzip.compress(source)), source)

    def test_truncated_gzip_rejected(self):
        with self.assertRaises((EOFError, OSError)):
            gzip.decompress(gzip.compress(b'<Root/>')[:-5])

    def test_strict_preflight_rejects_malformed_source(self):
        with self.assertRaises(ET.ParseError):
            ET.fromstring(b'<Root><Item>1</Root>')

    def test_document_library_recovery_gap(self):
        # This is an observed upstream limitation, not desired production behaviour.
        root = get_root_from_content(b'<Root><Item>1</Root>')
        self.assertEqual(root.tag, 'Root')


if __name__ == '__main__':
    unittest.main()
