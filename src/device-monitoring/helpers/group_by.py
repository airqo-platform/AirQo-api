from collections import defaultdict


def group_by(group_key, mapping_list):
    grouped_items = defaultdict(list)

    for v in mapping_list:
        grouped_items[v[group_key]].append(v)

    return grouped_items
