base_url = '/api/v1'
route = {
    'root': '/',
    'health_check': '/health',
    'device_status': base_url + '/device/monitor/status',
    'maintenance_logs': base_url + '/device/monitor/maintenance_logs',
    'device_name_maintenance_log': base_url + '/device/monitor/maintenance_logs/<device_name>',
    'device_power': base_url + '/device/monitor/power_type',
    'all_devices_latest_status': base_url + '/device/monitor/status/latest',
    'devices': base_url + '/device/monitor/devices',
    'latest_offline_devices': base_url + '/monitor/devices/offline',
    'network_uptime': base_url + '/monitor/network/uptime',
    'best_performing_devices': base_url + '/monitor/network/devices/bestperforming',
    'worst_performing_devices': base_url + '/monitor/network/devices/worstperforming',
    'device_uptime': base_url + '/monitor/device/uptime',
    'online_offline': base_url + '/monitor/devices/online_offline',
    'device_battery_voltage': base_url + '/monitor/device/batteryvoltage/<int:device_channel_id>',
    'device_sensor_correlation': base_url + '/monitor/device/sensors/correlation/<int:device_channel_id>',

}
