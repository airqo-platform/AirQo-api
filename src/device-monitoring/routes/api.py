base_url = '/api/v1/device/monitor'
base = '/api/v1'
route = {
    'root': '/',
    'health_check': '/health',
    'device_status': base_url + '/status',
    'all_devices_latest_status': base_url + '/status/latest',
    'devices': base_url + '/devices',
    'latest_offline_devices': base + '/monitor/devices/offline',
    'network_uptime': base+ '/monitor/network/uptime'
}
