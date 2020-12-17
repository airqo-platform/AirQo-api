def convert_model_ids(documents):
    docs = list(documents)

    for key, document in enumerate(docs):
        for k, v in dict(document).items():
            if k == '_id':
                document[k] = str(v)
            if v and isinstance(v, list) and isinstance(v[0], dict):
                convert_model_ids(v)
    return docs
