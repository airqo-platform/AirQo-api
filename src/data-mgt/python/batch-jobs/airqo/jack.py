import sys


def difference_btn_two_strings(string_a, string_b):
    """Returns difference between two strings. It's case insensitive function that
       formats all strings to lowercase.

    Args:
        string_a: First string
        string_b: Second String

    Returns:
        A set of characters not found in both strings.
    """
    set_a = set([char for char in string_a.lower()])
    set_b = set([char for char in string_b.lower()])

    diff = set_a.difference(set_b).union(set_b.difference(set_a))
    return diff


def difference_btn_two_strings_case_sensitive(string_a, string_b):
    """Returns difference between two strings. It's case sensitive function.
    Args:
        string_a: First string
        string_b: Second String

    Returns:
        A set of characters not found in both strings.
    """

    set_a = set([char for char in string_a])
    set_b = set([char for char in string_b])

    diff = set_a.difference(set_b).union(set_b.difference(set_a))
    return diff


if __name__ == "__main__":
    """Prints difference between two strings.
    Args:
        Only two strings
    Returns:
        Prints the difference
    Example:
        If you want to get the difference between kariem and karim
        $ python jack.py kariem karim
        Difference between kariem and karim is {'e'}
    """
    strings_list = sys.argv

    if len(strings_list) != 3:
        print("Please pass in only two strings")
    else:
        arg_a = f"{strings_list[1]}"
        arg_b = f"{strings_list[2]}"

        difference = difference_btn_two_strings(arg_a, arg_b)
        # In case you want the difference to be case sensitive, uncomment the line below and comment the one above
        # difference = difference_btn_two_strings_case_sensitive(arg_a, arg_b)

        if len(difference) == 0:
            print(f"There is no difference between {arg_a} and {arg_b}.")
        else:
            print(f"Difference between {arg_a} and {arg_b} is {str(difference)}.")
