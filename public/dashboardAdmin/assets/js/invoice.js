/*
Author       : Dreams Technologies
Template Name: Dreams AI
*/
(function () {
    "use strict";

    // Add Item Row
    var addItemBtn = document.querySelector(".add-item");
    if (addItemBtn) {
        addItemBtn.addEventListener("click", function (e) {
            e.preventDefault();

            const row = `
            <tr class="border-b border-border-color">
                <td class="px-4 py-3 text-start">
                    <i class="icon-grip-vertical"></i>
                </td>
                <td class="px-4 py-3 text-start">
                    <input type="text" class="form-input block w-full bg-light border-border-color rounded-lg focus:ring-0 focus:outline-none focus:border-border-color">
                </td>
                <td class="px-4 py-3 text-start">
                    <input type="text" class="form-input block w-full bg-light border-border-color rounded-lg focus:ring-0 focus:outline-none focus:border-border-color">
                </td>
                <td class="px-4 py-3 text-start">
                    <input type="text" class="form-input block w-full bg-light border-border-color rounded-lg qty focus:ring-0 focus:outline-none focus:border-border-color">
                </td>
                <td class="px-4 py-3 text-start">
                    <input type="text" class="form-input block w-full bg-light border-border-color rounded-lg amount focus:ring-0 focus:outline-none focus:border-border-color">
                </td>
                <td class="px-4 py-3 text-start">
                    <input type="text" class="form-input block w-full bg-light border-border-color rounded-lg total focus:ring-0 focus:outline-none focus:border-border-color" readonly>
                </td>
                <td class="px-4 py-3 text-start">
                    <button type="button" class="delete-item cursor-pointer">
                        <i class="icon-trash-2 hover:text-danger"></i>
                    </button>
                </td>
            </tr>
            `;

            document.querySelector("table tbody").insertAdjacentHTML("beforeend", row);
        });
    }

    // Delete Item Row (delegated — works on dynamically added rows)
    document.addEventListener("click", function (e) {
        var deleteBtn = e.target.closest(".delete-item");
        if (!deleteBtn) return;
        e.preventDefault();
        deleteBtn.closest("tr").remove();
        calculateGrandTotal();
    });

    // Auto Calculate Row Total (delegated — works on dynamically added inputs)
    document.addEventListener("input", function (e) {
        if (!e.target.closest(".qty") && !e.target.closest(".amount")) return;
        var row = e.target.closest("tr");
        var qty = parseFloat(row.querySelector(".qty").value) || 0;
        var amount = parseFloat(row.querySelector(".amount").value) || 0;
        row.querySelector(".total").value = (qty * amount).toFixed(2);
        calculateGrandTotal();
    });

    // Grand Total
    function calculateGrandTotal() {
        var grandTotal = 0;
        document.querySelectorAll(".total").forEach(function (el) {
            grandTotal += parseFloat(el.value) || 0;
        });
        var grandTotalEls = document.querySelectorAll(".grandtotal");
        if (grandTotalEls.length > 0) {
            grandTotalEls[grandTotalEls.length - 1].value = grandTotal.toFixed(2);
        }
    }

})();
