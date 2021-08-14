import re


def snake_to_camel(snake_str):
    """Converts string from snake_case to title/camel case(all first letters capitalized)

    Args:
        snake_str(string): the string to be converted

    Returns:
        (string): the string converted to title case
    """
    title_str = snake_str.split('_')
    return ' '.join(title_str).title()


def camel_to_snake(name):
    """Converts string from title/camel case(all first letters capitalized) to snake_case

    Args:
        name(string): the string to be converted

    Returns: the string converted to snake_case

    """
    name = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', name).lower()
