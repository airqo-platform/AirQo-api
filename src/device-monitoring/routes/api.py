base_url = '/api/v1/device/monitor'
base = '/api/v1'
route = {
    'root': '/',
    'health_check': '/health',
    'device_status': base_url + '/status',
    'maintenance_logs': base_url + '/maintenance_logs',
    'device_name_maintenance_log': base_url + '/maintenance_logs/<device_name>',
    'device_power': base_url + '/power_type',
    'all_devices_latest_status': base_url + '/status/latest',
    'devices': base_url + '/devices',
    'latest_offline_devices': base + '/monitor/devices/offline',
    'network_uptime': base + '/monitor/network/uptime',
    'best_performing_devices': base + '/monitor/network/devices/bestperforming',
    'worst_performing_devices': base + '/monitor/network/devices/worstperforming',
    'device_uptime': base + '/monitor/device/uptime/<int:device_channel_id>',
    'online_offline': base + '/monitor/devices/online_offline',

}
