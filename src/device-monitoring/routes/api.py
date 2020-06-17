base_url = '/api/v1/device/monitor'
route = {
    'root': '/',
    'health_check': '/health',
    'device_status': base_url + '/status',
    'all_devices_latest_status': base_url + '/status/latest',
    'devices': base_url + '/devices'
}
