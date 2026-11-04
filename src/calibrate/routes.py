base_url = "/api/v2/calibrate"

route = {
    "root": "/",
    "calibrate_tool": "/api/v1/calibrate/tool",
    "train_calibrate_tool": "/api/v1/calibrate/tool/train",
    "calibrate_tool_v2": f"{base_url}/tool",
    "train_calibrate_tool_v2": f"{base_url}/tool/train",
    "training_job_v2": f"{base_url}/tool/train/<job_id>",
}
