// Services/Print/Builders/PrintCssService.cs
using System.Text;

namespace Franchisee.Web.Services.Print.Builders
{
    public class PrintCssService
    {
        public string GetPrintCss()
        {
            return @"
/* Базовые стили */
body {
    font-family: 'Segoe UI', 'Arial', sans-serif;
    font-size: 13px;
    line-height: 1.2;
    background: white;
    margin: 0;
    padding: 8mm;
}

/* ========== ВСЕ ТАБЛИЦЫ ========== */
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0px;
}

/* ГРАНИЦЫ ДЛЯ ВСЕХ ЯЧЕЕК */
td, th {
    border: 1px solid #000000;
    padding: 3px 4px !important;
    font-size: 13px !important;
    vertical-align: top;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

th {
    font-weight: bold;
    background-color: #f0f0f0;
    text-align: center;
}

/* Соединяем таблицы в одну */
table + table {
    margin-top: -1px;
}

/* ========== MAIN INFO TABLE ========== */
table.main-info th,
table.main-info td {
    border: 1px solid #000000;
    padding: 3px 4px !important;
    font-size: 13px !important;
}

table.main-info th {
    text-align: left;
    font-weight: bold;
    background-color: #f5f5f5;
}

/* ========== WORK TABLES ========== */
.work-table th {
    background-color: #e0e0e0;
    text-align: center;
    font-size: 13px !important;
    padding: 3px 4px !important;
}

.work-table td {
    font-size: 13px !important;
    padding: 3px 4px !important;
}

/* ========== MONUMENT INFO ========== */
table.monument-info th {
    text-align: left;
    background-color: #f5f5f5;
    font-size: 13px !important;
    padding: 3px 4px !important;
}

table.monument-info th[colspan='2'] {
    text-align: center;
    background-color: #d0d0d0;
}

table.monument-info td {
    padding: 3px 4px !important;
    font-size: 13px !important;
}

/* ========== PAYMENTS ========== */
table.payments th {
    background-color: #e0e0e0;
    font-size: 13px !important;
    padding: 3px 4px !important;
}

table.payments th[colspan='8'] {
    text-align: center;
    background-color: #d0d0d0;
}

table.payments td {
    padding: 3px 4px !important;
    font-size: 13px !important;
}

/* ========== TOTALS ========== */
table.totals td {
    border: 1px solid #000000;
    padding: 3px 4px !important;
    font-weight: bold;
    font-size: 13px !important;
}

/* ========== SIGNATURES ========== */
table.signatures td {
    border: 1px solid #000000;
    padding: 4px 4px !important;
    font-size: 13px !important;
}

/* ========== ADDITIONAL INFO ========== */
table.additional-info th,
table.additional-info td {
    border: 1px solid #000000;
    padding: 3px 4px !important;
    font-size: 13px !important;
}

table.additional-info th {
    text-align: left;
    background-color: #f5f5f5;
    width: 15%;
}

/* ========== CONTINUATION HEADER ========== */
.continuation-header {
    font-weight: bold;
    text-align: center;
    background-color: #f0f0f0;
    border: 1px solid #000000;
    padding: 4px !important;
    margin-bottom: 0px;
    font-size: 13px !important;
}

/* ========== PAGE BREAKS ========== */
.page-break {
    page-break-before: always;
}

/* ========== UTILITY ========== */
.text-center {
    text-align: center;
}

.text-bold {
    font-weight: bold;
}

/* Убираем колонтитулы при печати и настраиваем поля */
@media print {
    @page {
        margin: 0.5cm;
        size: A4;
    }
    
    body {
        margin: 0;
        padding: 0.5cm;
    }
    
    /* Убираем URL, дату и время */
    header, footer {
        display: none !important;
    }
    
    @page :header {
        display: none;
    }
    
    @page :footer {
        display: none;
    }
    
    /* Компактный режим для печати */
    td, th {
        padding: 2px 3px !important;
        font-size: 12px !important;
    }
}
";
        }
    }
}