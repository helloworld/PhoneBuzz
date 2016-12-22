function fizzbuzz(number) {
	var arr = [];
	for(var i = 1; i <= number; i++) {
		if(i % (3 * 5) == 0) {
			arr.push("fizzbuzz");
		} else if(i % 3 == 0) {
			arr.push("fizz");
		} else if(i % 5 == 0) {
			arr.push("buzz");
		} else {
			arr.push(i);
		}
	}

	return arr;
}

module.exports = fizzbuzz;