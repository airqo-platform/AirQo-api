from utils.exceedances import CalculateExceedances


def calculate_exceedance(tenant):
    calculator = CalculateExceedances(tenant)
    exceedances = calculator.calculate_exceedances()
    calculator.save_exceedances(exceedances)
