// All amounts are stored in paise (smallest INR unit) everywhere in the DB
// and Razorpay API. These helpers are only for DISPLAY — never do money
// math in rupees/floats.

function paiseToRupees(paise) {
  return (paise / 100).toFixed(2);
}

function rupeesToPaise(rupees) {
  return Math.round(rupees * 100);
}

function formatINR(paise) {
  return `₹${paiseToRupees(paise)}`;
}

module.exports = { paiseToRupees, rupeesToPaise, formatINR };