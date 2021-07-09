from utils.exceedances import CalculateExceedances


def calculate_exceedance(tenant):
    exc_calculator = CalculateExceedances(tenant)
    exceedances = exc_calculator.calculate_exceedances()
    exc_calculator.save_exceedances(exceedances)
