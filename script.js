function fmt(n) {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function compute() {
    var principalEl = document.getElementById("principal");
    var yearsEl = document.getElementById("years");
    var result = document.getElementById("result");

    var principal = parseFloat(principalEl.value);
    var rate = parseFloat(document.getElementById("rate").value);
    var years = parseFloat(yearsEl.value);

    // Validate every input before computing anything.
    if (!isFinite(principal) || principal <= 0) {
        result.textContent = "";
        alert("Please enter a positive amount!");
        principalEl.focus();
        return;
    }
    if (!isFinite(rate) || rate <= 0) {
        result.textContent = "";
        alert("Please choose a positive interest rate!");
        document.getElementById("rate").focus();
        return;
    }
    if (!isFinite(years) || years <= 0) {
        result.textContent = "";
        alert("Please enter a positive number of years!");
        yearsEl.focus();
        return;
    }

    var interest = principal * years * rate / 100;
    var amount = principal + interest;

    // Maturity year from today's date plus the (possibly fractional) years.
    var maturity = new Date();
    maturity.setMonth(maturity.getMonth() + Math.round(years * 12));
    var year = maturity.getFullYear();

    result.innerHTML = "";
    function mark(text) {
        var m = document.createElement("mark");
        m.textContent = text;
        return m;
    }
    function text(t) { return document.createTextNode(t); }
    function br() { return document.createElement("br"); }

    result.appendChild(text("If you deposit "));
    result.appendChild(mark(fmt(principal)));
    result.appendChild(text(","));
    result.appendChild(br());
    result.appendChild(text("at an interest rate of "));
    result.appendChild(mark(rate + "%"));
    result.appendChild(br());
    result.appendChild(text("you will earn interest of "));
    result.appendChild(mark(fmt(interest)));
    result.appendChild(text(" and receive a total amount of "));
    result.appendChild(mark(fmt(amount)));
    result.appendChild(text(","));
    result.appendChild(br());
    result.appendChild(text("in the year "));
    result.appendChild(mark(String(year)));
    result.appendChild(br());
}

function updateRate() {
    var rateval = document.getElementById("rate").value;
    document.getElementById("rate_val").innerText = rateval;
}
