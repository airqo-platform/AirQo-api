base_url = '/api/v1/monitor'
route = {
    'root': '/',
    'health_check': '/health',
    'device_status': base_url + '/device/status',
    'maintenance_logs': base_url + '/device/maintenance_logs',
    'device_name_maintenance_log': base_url + '/device/maintenance_logs/<device_name>',
    'device_power': base_url + '/device/power_type',
    'all_devices_latest_status': base_url + '/device/status/latest',
    'devices': base_url + '/devices',
    'latest_offline_devices': base_url + '/devices/offline',
    'network_uptime': base_url + '/network/uptime',
    'best_performing_devices': base_url + '/network/devices/bestperforming',
    'worst_performing_devices': base_url + '/network/devices/worstperforming',
    'device_uptime': base_url + '/device/uptime',
    'online_offline': base_url + '/devices/online_offline',
    'device_battery_voltage': base_url + '/device/batteryvoltage',
    'device_sensor_correlation': base_url + '/device/sensors/correlation',

}
