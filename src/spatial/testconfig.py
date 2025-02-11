from configure import get_trained_model_from_gcs, Config

import tensorflow as tf

"""
tflite_model_path = get_trained_model_from_gcs(
                Config.GOOGLE_CLOUD_PROJECT_ID,
                Config.PROJECT_BUCKET,
                "optimized_pollutant_model.tflite",
            )
"""
#print(tflite_model_path)
#print("why is print not working")

import gcsfs
import tensorflow as tf

def load_tflite_model_from_gcs(project_name, bucket_name, source_blob_name):
    # Create a GCSFileSystem object
    fs = gcsfs.GCSFileSystem(project=project_name)
    
    # Construct the full path to the model in GCS
    gcs_model_path = f"gs://{bucket_name}/{source_blob_name}"
    
    try:
        # Open the TFLite model file from GCS
        with fs.open(gcs_model_path, "rb") as model_file:
            # Load the TFLite model
            tflite_model = tf.lite.Interpreter(model_content=model_file.read())
            tflite_model.allocate_tensors()  # Allocate tensors for the model
            return tflite_model  # Return the loaded model interpreter
    except Exception as e:
        print(f"Error loading TFLite model from GCS: {e}")
        return None

# Usage example
if __name__ == "__main__":
    project_id = Config.GOOGLE_CLOUD_PROJECT_ID
    bucket_name = Config.PROJECT_BUCKET
    tflite_model_name = "optimized_pollutant_model.tflite"

    tflite_model_interpreter = load_tflite_model_from_gcs(Config.GOOGLE_CLOUD_PROJECT_ID, Config.PROJECT_BUCKET, "optimized_pollutant_model.tflite")

    if tflite_model_interpreter:
        print("TFLite model loaded successfully.")
        # You can now use tflite_model_interpreter for inference.
    else:
        print("Failed to load TFLite model.")
