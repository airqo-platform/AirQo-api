const date = {
  monthsFromNow: (number) => {
    const num = isNaN(number) ? 1 : number;
    const d = new Date();
    const targetMonth = d.getMonth() + num;
    d.setMonth(targetMonth);
    if (d.getMonth() !== targetMonth % 12) {
      d.setDate(0);
    }
    return d;
  },
};

module.exports = date;
