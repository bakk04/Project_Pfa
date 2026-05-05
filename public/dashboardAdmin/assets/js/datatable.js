

// Data Table
if ($(".datatable").length > 0) {
    $(".datatable").DataTable({
      retrieve: true,
      pageLength: 10,
      lengthMenu: [
        [10, 25, 50, -1],
        [10, 25, 50, "All"],
      ],

      // IMPORTANT: allow DataTables to generate controls
      dom: "lfrtip",

      language: {
        search: "",
        searchPlaceholder: "Search...",
        info: "_START_ - _TOTAL_ Entries",
        lengthMenu: "Show _MENU_ Entries",
        paginate: {
          next: '<i class="icon icon-chevron-right"></i>',
          previous: '<i class="icon icon-chevron-left"></i>',
        },
      },

      initComplete: function () {
        $(".dt-info").appendTo("#tableinfo");
        $(".dt-paging").appendTo("#tablepage");
        $(".dt-length").appendTo("#tablelength");
        $(".dataTables_filter").appendTo("#tablefilter");
        $(".dt-search").appendTo("#tablesearch");

        $(".dataTables_filter input").addClass(
          "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
        );

        $(".dataTables_length select").addClass(
          "px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
        );

        $(".dataTables_info").addClass("text-sm text-gray-600");

        $(".dt-paging a").addClass(
          "px-2 py-1.5 inline-flex text-xs font-medium rounded-lg border border-border-color bg-light text-dark hover:bg-primary hover:text-white",
        );
      },
    });
}