"""from airqo_etl_utils.sql import query_manager


def main():
    print("Available queries:", sorted(query_manager.list_queries()))
    q = query_manager.get_query('merged_hourly')
    print('Placeholders for merged_hourly:', q.placeholders)
    sql = q.format(
        geo_table='project.dataset.geo_table',
        sat_table='project.dataset.sat_table',
        start_date='2025-01-01',
        end_date='2025-01-02',
        distance_meters=100,
    )
    print('\nRendered SQL preview:\n', sql[:400])


if __name__ == '__main__':
    main()
"""
