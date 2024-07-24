from great_expectations.core.expectation_configuration import ExpectationConfiguration


class AirQoGxExpectattions:
    def __init__(self, expectation_suite_name):
        """
        Initialize GxMetrics with a Great Expectations context and expectation suite name.

        Args:
            context (DataContext): Great Expectations DataContext object.
            expectation_suite_name (str): The name of the expectation suite.
        """
        self.expectation_suite_name = expectation_suite_name

    def add_expectation(self, expectation_type, **kwargs):
        """
        Add an expectation to the suite.

        Args:
            expectation_type (str): The type of the expectation.
            **kwargs: The keyword arguments for the expectation.

        Returns:
            ExpectationConfiguration: The configuration of the added expectation.
        """
        expectation_config = ExpectationConfiguration(
            expectation_type=expectation_type, kwargs=kwargs
        )
        return expectation_config

    def expect_column_to_exist(self, column):
        """
        Expect the specified column to exist.

        Args:
            column (str): The name of the column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_column_to_exist", column=column)

    def expect_column_values_to_not_match_regex_list(self, column, regex_list):
        """
        Expect the column entries to be strings that do not match any of a list of regular expressions.

        Args:
            column (str): The name of the column.
            regex_list (list): The list of regular expressions.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_match_regex_list",
            column=column,
            regex_list=regex_list,
        )

    def expect_column_values_to_not_match_regex(self, column, regex):
        """
        Expect the column entries to be strings that do NOT match a given regular expression.

        Args:
            column (str): The name of the column.
            regex (str): The regular expression.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_match_regex", column=column, regex=regex
        )

    def expect_column_values_to_not_be_in_set(self, column, value_set):
        """
        Expect column entries to not be in the set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_be_in_set", column=column, value_set=value_set
        )

    def expect_column_values_to_match_regex_list(self, column, regex_list):
        """
        Expect the column entries to be strings that match any of a list of regular expressions.

        Args:
            column (str): The name of the column.
            regex_list (list): The list of regular expressions.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_match_regex_list",
            column=column,
            regex_list=regex_list,
        )

    def expect_column_values_to_match_regex(self, column, regex):
        """
        Expect the column entries to be strings that match a given regular expression.

        Args:
            column (str): The name of the column.
            regex (str): The regular expression.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_match_regex", column=column, regex=regex
        )

    def expect_column_values_to_be_between(self, column, min_value, max_value):
        """
        Expect the column entries to be between a minimum value and a maximum value (inclusive).

        Args:
            column (str): The name of the column.
            min_value (float): The minimum value.
            max_value (float): The maximum value.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_value_lengths_to_equal(self, column, value):
        """
        Expect the column entries to be strings with length equal to the provided value.

        Args:
            column (str): The name of the column.
            value (int): The expected length.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_value_lengths_to_equal", column=column, value=value
        )

    def expect_column_value_lengths_to_be_between(self, column, min_value, max_value):
        """
        Expect the column entries to be strings with length between a minimum value and a maximum value (inclusive).

        Args:
            column (str): The name of the column.
            min_value (int): The minimum length.
            max_value (int): The maximum length.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_value_lengths_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_unique_value_count_to_be_between(
        self, column, min_value, max_value
    ):
        """
        Expect the number of unique values to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (int): The minimum number of unique values.
            max_value (int): The maximum number of unique values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_unique_value_count_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_sum_to_be_between(self, column, min_value, max_value):
        """
        Expect the column sum to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum sum.
            max_value (float): The maximum sum.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_sum_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_stdev_to_be_between(self, column, min_value, max_value):
        """
        Expect the column standard deviation to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum standard deviation.
            max_value (float): The maximum standard deviation.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_stdev_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_quantile_values_to_be_between(self, column, quantile_ranges):
        """
        Expect the specific provided column quantiles to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            quantile_ranges (dict): The dictionary containing quantiles and their respective ranges.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_quantile_values_to_be_between",
            column=column,
            quantile_ranges=quantile_ranges,
        )

    def expect_column_proportion_of_unique_values_to_be_between(
        self, column, min_value, max_value
    ):
        """
        Expect the proportion of unique values to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum proportion.
            max_value (float): The maximum proportion.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_proportion_of_unique_values_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_most_common_value_to_be_in_set(self, column, value_set):
        """
        Expect the most common value to be within the designated value set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_most_common_value_to_be_in_set",
            column=column,
            value_set=value_set,
        )

    def expect_column_k_l_divergence_to_be_less_than(
        self, column, partition_object, threshold
    ):
        """
        Expect the Kulback-Leibler (KL) divergence (relative entropy) of the specified column with respect to the partition object to be lower than the provided threshold.

        Args:
            column (str): The name of the column.
            partition_object (dict): The partition object.
            threshold (float): The threshold for KL divergence.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_k_l_divergence_to_be_less_than",
            column=column,
            partition_object=partition_object,
            threshold=threshold,
        )

    def expect_column_distinct_values_to_equal_set(self, column, value_set):
        """
        Expect the set of distinct column values to equal a given set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_distinct_values_to_equal_set",
            column=column,
            value_set=value_set,
        )

    def expect_column_distinct_values_to_contain_set(self, column, value_set):
        """
        Expect the set of distinct column values to contain a given set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_distinct_values_to_contain_set",
            column=column,
            value_set=value_set,
        )

    def expect_column_distinct_values_to_be_in_set(self, column, value_set):
        """
        Expect the set of distinct column values to be contained by a given set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_distinct_values_to_be_in_set",
            column=column,
            value_set=value_set,
        )

    def expect_column_max_to_be_between(self, column, min_value, max_value):
        """
        Expect the column maximum to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum value.
            max_value (float): The maximum value.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_max_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_mean_to_be_between(self, column, min_value, max_value):
        """
        Expect the column mean to be between a minimum value and a maximum value (inclusive).

        Args:
            column (str): The name of the column.
            min_value (float): The minimum value.
            max_value (float): The maximum value.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_mean_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_median_to_be_between(self, column, min_value, max_value):
        """
        Expect the column median to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum value.
            max_value (float): The maximum value.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_median_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_min_to_be_between(self, column, min_value, max_value):
        """
        Expect the column minimum to be between a minimum value and a maximum value.

        Args:
            column (str): The name of the column.
            min_value (float): The minimum value.
            max_value (float): The maximum value.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_min_to_be_between",
            column=column,
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_pair_values_a_to_be_greater_than_b(self, column_A, column_B):
        """
        Expect the values in column A to be greater than column B.

        Args:
            column_A (str): The name of the first column.
            column_B (str): The name of the second column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_pair_values_a_to_be_greater_than_b",
            column_A=column_A,
            column_B=column_B,
        )

    def expect_column_pair_values_to_be_equal(self, column_A, column_B):
        """
        Expect the values in column A to be the same as column B.

        Args:
            column_A (str): The name of the first column.
            column_B (str): The name of the second column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_pair_values_to_be_equal",
            column_A=column_A,
            column_B=column_B,
        )

    def expect_column_pair_values_to_be_in_set(
        self, column_A, column_B, value_pairs_set
    ):
        """
        Expect the paired values from columns A and B to belong to a set of valid pairs.

        Args:
            column_A (str): The name of the first column.
            column_B (str): The name of the second column.
            value_pairs_set (list): The set of valid value pairs.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_pair_values_to_be_in_set",
            column_A=column_A,
            column_B=column_B,
            value_pairs_set=value_pairs_set,
        )

    def expect_column_to_exist(self, column):
        """
        Expect the specified column to exist.

        Args:
            column (str): The name of the column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_column_to_exist", column=column)

    def expect_column_values_to_be_in_set(self, column, value_set):
        """
        Expect each column value to be in a given set.

        Args:
            column (str): The name of the column.
            value_set (list): The set of values.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_be_in_set", column=column, value_set=value_set
        )

    def expect_column_values_to_be_null(self, column):
        """
        Expect the column values to be null.

        Args:
            column (str): The name of the column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_column_values_to_be_null", column=column)

    def expect_column_values_to_be_of_type(self, column, type_):
        """
        Expect a column to contain values of a specified data type.

        Args:
            column (str): The name of the column.
            type_ (str): The expected data type.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_be_of_type", column=column, type_=type_
        )

    def expect_column_values_to_be_unique(self, column):
        """
        Expect each column value to be unique.

        Args:
            column (str): The name of the column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_column_values_to_be_unique", column=column)

    def expect_column_values_to_not_be_null(self, column):
        """
        Expect the column values to not be null.

        Args:
            column (str): The name of the column.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_be_null", column=column
        )

    def expect_compound_columns_to_be_unique(self, column_list):
        """
        Expect the compound columns to be unique.

        Args:
            column_list (list): The list of column names.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_compound_columns_to_be_unique", column_list=column_list
        )

    def expect_multicolumn_sum_to_equal(self, column_list, sum_total):
        """
        Expect that the sum of row values in a specified column list is the same for each row, and equal to a specified sum total.

        Args:
            column_list (list): The list of column names.
            sum_total (float): The expected sum total.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_multicolumn_sum_to_equal",
            column_list=column_list,
            sum_total=sum_total,
        )

    def expect_select_column_values_to_be_unique_within_record(self, column_list):
        """
        Expect the values for each record to be unique across the columns listed. Note that records can be duplicated.

        Args:
            column_list (list): The list of column names.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_select_column_values_to_be_unique_within_record",
            column_list=column_list,
        )

    def expect_table_column_count_to_be_between(self, min_value, max_value):
        """
        Expect the number of columns to be between two values.

        Args:
            min_value (int): The minimum number of columns.
            max_value (int): The maximum number of columns.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_table_column_count_to_be_between",
            min_value=min_value,
            max_value=max_value,
        )

    def expect_table_column_count_to_equal(self, value):
        """
        Expect the number of columns in a table to equal a value.

        Args:
            value (int): The expected number of columns.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_table_column_count_to_equal", value=value)

    def expect_table_columns_to_match_ordered_list(self, column_list):
        """
        Expect the columns to exactly match a specified list.

        Args:
            column_list (list): The ordered list of column names.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_table_columns_to_match_ordered_list", column_list=column_list
        )

    def expect_table_columns_to_match_set(self, column_set):
        """
        Expect the columns to match an unordered set.

        Args:
            column_set (set): The unordered set of column names.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_table_columns_to_match_set", column_set=column_set
        )

    def expect_table_row_count_to_equal(self, value):
        """
        Expect the number of rows to equal a value.

        Args:
            value (int): The expected number of rows.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation("expect_table_row_count_to_equal", value=value)

    def expect_table_row_count_to_be_between(self, min_value, max_value):
        """
        Expect the number of rows to be between two values.

        Args:
            min_value (int): The minimum number of rows.
            max_value (int): The maximum number of rows.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_table_row_count_to_be_between",
            min_value=min_value,
            max_value=max_value,
        )

    def expect_column_values_to_be_in_type_list(self, column, type_list):
        """
        Expect a column to contain values from a specified type list.

        Args:
            column (str): The name of the column.
            type_list (list): The list of types.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_be_in_type_list",
            column=column,
            type_list=type_list,
        )

    def expect_column_values_to_not_match_like_pattern_list(
        self, column, like_pattern_list
    ):
        """
        Expect the column entries to be strings that do NOT match any of a provided list of like pattern expressions.

        Args:
            column (str): The name of the column.
            like_pattern_list (list): The list of like pattern expressions.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_match_like_pattern_list",
            column=column,
            like_pattern_list=like_pattern_list,
        )

    def expect_column_values_to_not_match_like_pattern(self, column, like_pattern):
        """
        Expect the column entries to be strings that do NOT match a given like pattern expression.

        Args:
            column (str): The name of the column.
            like_pattern (str): The like pattern expression.

        Returns:
            ExpectationConfiguration: The configuration of the expectation.
        """
        return self.add_expectation(
            "expect_column_values_to_not_match_like_pattern",
            column=column,
            like_pattern=like_pattern,
        )

    def get_expectation_metrics(self, validator):
        """
        Get metrics for all expectations in the suite.

        Args:
            validator: The Great Expectations validator.

        Returns:
            dict: A dictionary containing metrics for each expectation.
        """
