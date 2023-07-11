base_url = "/api/v2/predict-faults"

route = {
    "root": "/",
    "predict_faults_catboost": f"{base_url}/catboost",
    "predict_faults_lstm": f"{base_url}/lstm",
}
