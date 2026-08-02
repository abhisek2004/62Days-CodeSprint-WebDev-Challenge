const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let encodingJobs = [
  { jobId: "job_v101", filename: "surgery_lecture_master.mp4", status: "COMPLETED", progressPct: 100, durationSec: 120 },
  { jobId: "job_v102", filename: "cardiology_webinar_4k.raw", status: "PROCESSING", progressPct: 65, durationSec: 300 }
];

const mockHlsManifest = {
  masterPlaylist: `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2800000,RESOLUTION=1280x720
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=854x480
480p/index.m3u8`,
  segments: [
    { segmentName: "segment_001.ts", durationSec: 4.0, sizeKb: 2450, resolution: "1080p" },
    { segmentName: "segment_002.ts", durationSec: 4.0, sizeKb: 2510, resolution: "1080p" },
    { segmentName: "segment_003.ts", durationSec: 4.0, sizeKb: 2390, resolution: "1080p" },
    { segmentName: "segment_004.ts", durationSec: 4.0, sizeKb: 2480, resolution: "1080p" }
  ]
};

app.get("/api/hls/jobs", (req, res) => {
  res.json({ success: true, jobs: encodingJobs, manifest: mockHlsManifest });
});

app.post("/api/hls/start-job", (req, res) => {
  const { filename } = req.body;
  const newJob = {
    jobId: `job_${Math.floor(Math.random() * 9000 + 1000)}`,
    filename: filename || "medical_demo.mp4",
    status: "PROCESSING",
    progressPct: 10,
    durationSec: 180
  };
  encodingJobs.unshift(newJob);
  res.json({ success: true, job: newJob });
});

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
  console.log(`HLS Transcoding Pipeline Engine running on port ${PORT}`);
});
