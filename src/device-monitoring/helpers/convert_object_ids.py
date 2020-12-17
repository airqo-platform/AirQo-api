
def convert_model_ids(documents):
    docs = list(documents)
    for document in documents:
        for k, v in dict(document).items():
            if k == '_id':
                document[k] = str(v)
            if isinstance(v, list):
                convert_model_ids(v)
    return docs
