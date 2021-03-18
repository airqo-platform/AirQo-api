import pandas as pd


def merge_one_dataset_into_another(dataset_one_csv, dataset_two_csv, dataset_one_pk, dataset_two_pk, csv_output_path):
    dataset_one = pd.read_csv(dataset_one_csv)
    dataset_two = pd.read_csv(dataset_two_csv)
    final_dataset = []

    for index, row in dataset_one.iterrows():
        series_row = dataset_two.loc[dataset_two[dataset_two_pk] == row[dataset_one_pk]]

        new_series_row = row

        try:
            new_series_row["siteName"] = series_row["an_name"].item()
            new_series_row["locationName"] = series_row["an_map_address"].item()

            final_dataset.append(new_series_row)

        except Exception as ex:
            print(ex)

    print(final_dataset)
    pd.DataFrame(final_dataset).to_csv(csv_output_path)


if __name__ == '__main__':
    merge_one_dataset_into_another("datasets/devices_mar_2021.csv",
                                   "datasets/tbl_app_nodes_comma.csv", "channelID",
                                   "an_channel_id", "/home/noah/output.csv")
