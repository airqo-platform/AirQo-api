base_url = "/api/v2/calibrate"

route = {
    "root": "/",
    "calibrate_tool_v2": f"{base_url}/tool",
    "train_calibrate_tool_v2": f"{base_url}/tool/train",
    "training_job_v2": f"{base_url}/tool/train/<job_id>",
    "trained_model_calibrate_v2": f"{base_url}/tool/train/<job_id>/calibrate",
}
