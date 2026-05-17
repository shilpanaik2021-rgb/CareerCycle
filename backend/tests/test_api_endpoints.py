import os
import unittest
import sys
from fastapi.testclient import TestClient

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

class TestApiEndpoints(unittest.TestCase):
    
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        
    def test_get_stats_endpoint(self):
        """Test GET /api/stats returns correct metrics JSON structure."""
        response = self.client.get("/api/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total", data)
        self.assertIn("applied", data)
        self.assertIn("interview", data)
        self.assertIn("offer", data)
        self.assertIn("rejected", data)

    def test_get_jobs_endpoint(self):
        """Test GET /api/jobs returns a list of jobs."""
        response = self.client.get("/api/jobs")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsInstance(data, list)

    def test_get_config_endpoint(self):
        """Test GET /api/config returns safe configurations."""
        response = self.client.get("/api/config")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("mistral_api_key", data)
        self.assertIn("search_location", data)

    def test_task_status_endpoint(self):
        """Test GET /api/task-status returns running flag."""
        response = self.client.get("/api/task-status")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("running", data)
        self.assertIsInstance(data["running"], bool)

if __name__ == '__main__':
    unittest.main()
