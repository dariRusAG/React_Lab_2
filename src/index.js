import React from 'react';
import {useEffect, useMemo, useRef, useState} from "react";
import ReactDOM from 'react-dom/client';
import './index.css';
import parsedData from "./data.js";
import * as d3 from "d3";

const root = ReactDOM.createRoot(document.getElementById('root'));

function generateKey(label) {
    return label.toLowerCase()
        .replace(/number/g, '#')
        .replace(/\W/g, '_');
}

const TableRow = props => {
    const cells = (props.isHead === "0")
        ? props.data.map((item, index) => <td key={index}> {
            typeof item == "boolean" ? item.toString() : item
        } </td>)
        : props.data.map((item, index) => <th key={index}> {item} </th>)

    return (
        <>
            {cells}
        </>
    )
}

/*
thead таблицы:
- headers -данные для шапки таблицы в виде объекта с атрибутами key и label
 */
const TableHead = props => {
    const headersToArray = headers => {
        return headers.map(header => header.label);
    };

    return (
        <thead>
        <tr>
            <TableRow data={headersToArray(props.headers)} isHead="1"/>
        </tr>
        </thead>
    )
}

/*
tbody таблицы:
- numPage: номер текущей страницы
- amountRows: количество строк таблицы на странице
 */
const TableBody = props => {

    // индексы строк, которые нужно вывести
    const begRange = (props.numPage - 1) * props.amountRows;
    const endRange = begRange + Number(props.amountRows);

    // формируем строки на основе переданных данных
    const tbody = props.data.map((item, index) =>
        // оставляем видимыми только строки, индексы которых принадлежат интервалу
        <tr key={index} className={
            (index >= begRange && index < endRange) ? "show" : "hide"
        }>
            <TableRow data={Object.values(item)} isHead="0"/>
        </tr>
    );

    return (
        <tbody>{tbody}</tbody>
    )
}

/*
Поле ввода
 */
const FilterInput = props => {
    function getUniqueValues() {
        const tempUniqueValues = new Set();
        if (typeof props.data[0][props.filter.label] === "boolean") {
            tempUniqueValues.add("true");
            tempUniqueValues.add("false");
        } else {
            props.data.forEach(row => {
                tempUniqueValues.add(row[props.filter.label]);
            });
        }
        return tempUniqueValues;
    }

    function getInputType() {
        const maxSelectAmount = 20;
        switch (typeof props.data[0][props.filter.label]) {
            case "string":
                return getUniqueValues().size > maxSelectAmount ? "text" : "select";
            case "number":
                return getUniqueValues().size > maxSelectAmount ? "number" : "select";
            case "boolean":
                return "select";
        }
    }

    const handleChange = event => {
        const value = event.target.value;

        let newFilterConfig = [...props.filterConfig];

        // сохраняем значение поля
        newFilterConfig[props.index].value = value.toLowerCase();

        // передаём родительскому компоненту новое состояние полей фильтрации
        props.setFilterConfig(newFilterConfig);

        doFiltering(newFilterConfig, props.data);
    }

    const doFiltering = (filterConfig, arr) => {
        filterConfig.map(filter => {
            arr = arr.filter(item => {
                    const value = item[filter.label];
                    return value === null
                        ? ''.includes(filter.value)
                        : value.toString().toLowerCase().includes(filter.value);
                }
            );
        });

        // передаём родительскому компоненту новое состояние — отфильтрованный массив
        props.filtering(arr);
    };

    const getInput = () => {
        const inputType = getInputType();
        switch (inputType) {
            case "text":
            case "number":
                return <input
                    type={inputType}
                    key={props.filter.key}
                    value={props.filter.value}
                    onChange={handleChange}
                />
            case "select":
                const options = Array.from(getUniqueValues()).map(label =>
                    <option selected={label !== null
                        && label.toString().toLowerCase() === props.filter.value}>
                        {label}
                    </option>
                );
                return <select onChange={handleChange}>
                    <option value=''></option>
                    {options}
                </select>;
        }
    }

    return (
        <label className="block">
            <span className="input-label">{props.filter.label}</span>
            {getInput()}
        </label>
    )
}

/*
Форма с фильтрами
 */
const FilterForm = props => {
    // начальное значение состояния для хранения значений полей фильтров
    const initialFilterConfigState = props.filters.map(filter => {
        return {...filter, value: '', type: ''};
    });

    // состояние для хранения значений полей фильтров
    const [filterConfig, setFilterConfig] = useState(initialFilterConfigState);

    const handleClearForm = event => {
        event.preventDefault();

        // setFilterConfig(initialFilterConfigState);
        window.location.reload();
    };

    const filters = filterConfig.map((filter, index) =>
        <FilterInput
            data={props.data}
            filter={filter}
            index={index}
            setFilterConfig={setFilterConfig}
            filterConfig={filterConfig}
            filtering={props.filtering}
        />
    );

    return (
        <form>
            <h4>Поиск <button onClick={handleClearForm}>Очистить</button></h4>
            {filters}
        </form>
    )
}

/*
Поле сортировки
 */
const SortInput = props => {

    const handleChange = event => {
        // определяем новую конфигурацию сортировки
        let newSortConfig = props.sortConfig;
        newSortConfig[props.index].field = props.sortConfig[props.index].options
            .filter(field => field.label === event.target.value)[0];

        // если в очередном поле со списком изменили выбранную опцию - все следующие удаляем
        newSortConfig = newSortConfig.filter((item, index) => index <= props.index);

        // передаём родительскому компоненту новую конфигурацию сортировки
        props.updateSortConfig([
            ...newSortConfig,
            {
                field: {key: "", label: ""},
                direction: 'ascending',
                options: props.sortConfig[props.index].options
                    .filter(item => item.key !== props.sortConfig[props.index].field.key)
            }
        ]);
    };

    const handleDirectionChange = event => {
        // определяем новую конфигурацию сортировки
        let newSortConfig = [...props.sortConfig];
        newSortConfig[props.index].direction === "descending"
            ? newSortConfig[props.index].direction = "ascending"
            : newSortConfig[props.index].direction = "descending";

        // передаём родительскому компоненту новую конфигурацию сортировки
        props.updateSortConfig(newSortConfig);
    };

    const options = props.sortConfig[props.index].options.map(field =>
        <option key={field.key}>{field.label}</option>
    );

    const directionInput = (
        <label>
            <input
                type="checkbox"
                id={`descending-${props.index}`}
                name={`direction${props.index}`}
                value="descending"
                checked={props.direction === "descending"}
                onChange={handleDirectionChange}
            />
            <span>по убыванию</span>
        </label>
    );

    return (
        <div>
            <select id={`sort-field${props.index}`}
                    key={props.field.key}
                    value={props.field.label}
                    onChange={handleChange}
            >
                <option key=""></option>
                {options}
            </select>
            <div>
                {directionInput}
            </div>
        </div>
    );
};

/*
Форма с полями сортировки
 */
const SortForm = props => {
    const initialSortConfig = [{
        field: {key: "", label: ""},
        direction: 'ascending',
        options: props.options
    }];

    const [sortConfig, setSortConfig] = useState(initialSortConfig);

    useEffect(() => {
        props.sorting([...props.data].sort(multiSort));
    }, [sortConfig])

    const multiSort = (a, b) => {
        for (const item of sortConfig) {
            const label = item.field.label;
            const direction = item.direction;
            if (a[label] < b[label]) {
                return direction === 'ascending' ? -1 : 1;
            }
            if (a[label] > b[label]) {
                return direction === 'ascending' ? 1 : -1;
            }
        }
        return 0;
    };

    const handleClearForm = event => {
        event.preventDefault();

        setSortConfig(initialSortConfig);
    };

    const sortInputs = sortConfig.map((item, index) => (
            <SortInput
                index={index}
                field={{key: item.field.key, label: item.field.label}}
                direction={item.direction}
                sortConfig={sortConfig}
                updateSortConfig={setSortConfig}
            />
        )
    );

    return (
        <form>
            <h4>Сортировка <button onClick={handleClearForm}>Очистить</button></h4>
            {sortInputs}
        </form>
    );
};

/*
Форма с полями группировки
 */
const GroupFormAndChart = props => {
    const initialGroupConfigState = {
        options: useRef(props.options).current,
        values: useRef(props.values).current,
        data: useRef(props.data).current,
        option: "",
        value: ""
    };
    const initialChartConfigState = ["min"];
    const [groupConfig, setGroupConfig] = useState(initialGroupConfigState);
    const [chartConfig, setChartConfig] = useState(initialChartConfigState);

    useEffect(() => {
        props.grouping(!isInitialState()
            ? chartData(groupConfig.data, groupConfig.option.label, groupConfig.value.label)
            : groupConfig.data
        );
        props.setHeaders(!isInitialState()
            ? [
                groupConfig.option,
                {key: generateKey("amount"), label: groupConfig.value.label + " amount"},
                {key: generateKey("min"), label: groupConfig.value.label + " min"},
                {key: generateKey("max"), label: groupConfig.value.label + " max"},
                {key: generateKey("mean"), label: groupConfig.value.label + " mean"}
            ]
            : groupConfig.options
        );
    }, [groupConfig])

    function chartData(data, groupKey, valueKey) {
        const groupObj = d3.group(data, d => d[groupKey]);

        let groupData = [];

        groupObj.forEach((value, key) => {
            const minMax = d3.extent(value.map(d => d[valueKey]));
            const sum = d3.sum(value.map(d => d[valueKey]));

            const amount = value.length;
            const [min, max] = minMax;
            const mean = sum / value.length;

            groupData.push({
                label: key,
                amount: amount,
                min: min,
                max: max,
                mean: mean
            });
        });

        return groupData;
    }

    function isInitialState() {
        return JSON.stringify(groupConfig) === JSON.stringify(initialGroupConfigState);
    }

    const values = groupConfig.values.map(value =>
        <option key={value.key}>{value.label}</option>
    );

    const handleChangeValue = event => {
        const label = event.target.value;

        setGroupConfig({
            ...groupConfig,
            value: {
                key: generateKey(label),
                label: label
            }
        });
    };

    const handleAddGrouping = event => {
        event.preventDefault();

        setGroupConfig({
            ...groupConfig,
            option: groupConfig.options[1],
            value: groupConfig.values[0]
        });
    };

    const handleClearForm = event => {
        event.preventDefault();

        setGroupConfig(initialGroupConfigState);
        setChartConfig(initialChartConfigState);
    };

    const handleChangeChartData = event => {
        event.target.checked
            ? setChartConfig([...chartConfig, event.target.value])
            : setChartConfig(chartConfig.filter(item => item !== event.target.value));
    }

    const margin = {top: 40, bottom: 60, left: 40, right: 40};

    return (
        <>
            <form>
                <h4>
                    График
                    <button onClick={handleAddGrouping} disabled={!isInitialState()}>Построить</button>
                    <button onClick={handleClearForm}>Очистить</button>
                </h4>
                {!isInitialState() &&
                    <>
                        <label className="block">
                            <span className="input-label">По полю</span>
                            <span>Nationality</span>
                        </label>
                        <label className="block">
                            <span className="input-label">Взять значения</span>
                            <select onChange={handleChangeValue}>{values}</select>
                        </label>
                        <div>
                            <label className="block">
                                <input type="checkbox" value="min"
                                       defaultChecked={chartConfig.includes("min")}
                                       onChange={handleChangeChartData}/>
                                <span>Минимальное значение</span>
                            </label>
                            <label className="block">
                                <input type="checkbox" value="max"
                                       defaultChecked={chartConfig.includes("max")}
                                       onChange={handleChangeChartData}/>
                                <span>Максимальное значение</span>
                            </label>
                            <label className="block">
                                <input type="checkbox" value="mean"
                                       defaultChecked={chartConfig.includes("mean")}
                                       onChange={handleChangeChartData}/>
                                <span>Среднее значение</span>
                            </label>
                        </div>
                    </>
                }

            </form>
            {!isInitialState() &&
                <Chart width="800" height="400"
                       margin={margin}
                       data={chartData(groupConfig.data, groupConfig.option.label, groupConfig.value.label)}
                       chartConfig={chartConfig}
                />
            }
        </>
    )
}

const Chart = props => {
    const axesRef = useRef(null);

    // ширина и высота области для вывода графиков
    const boundsWidth = props.width - props.margin.left - props.margin.right;
    const boundsHeight = props.height - props.margin.top - props.margin.bottom;

    // определяем минимальные максимальные значения по OY
    let min = d3.min(props.data.map(d => d.min));
    let max = d3.max(props.data.map(d => d.max));

    // формируем шкалы для осей
    const scaleX = useMemo(() => {
        return d3.scaleBand()
            .domain(props.data.map(d => d.label))
            .range([0, boundsWidth])
    }, [props.data, boundsWidth]);

    const scaleY = useMemo(() => {
        return d3.scaleLinear()
            .domain([min * 0.8, max * 1.2])
            .range([boundsHeight, 0])
    }, [boundsHeight, min, max]);

    // создаем область с осями и графиком с помощью d3
    useEffect(() => {
        const svgElement = d3.select(axesRef.current);
        svgElement.selectAll("*").remove();

        // рисуем оси
        const xAxis = d3.axisBottom(scaleX);
        svgElement
            .append("g")
            .attr("transform", `translate(${props.margin.left}, ${props.height - props.margin.bottom})`)
            .call(xAxis)
            .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", d => "rotate(-30)");

        const yAxis = d3.axisLeft(scaleY);
        svgElement
            .append("g")
            .attr("transform", `translate(${props.margin.left}, ${props.margin.top})`)
            .call(yAxis);

        //рисуем график
        const colors = ["blue", "red", "green"];
        const values = props.chartConfig;
        values.map((value, index) => {
            svgElement
                .selectAll(".dot")
                .data(props.data)
                .enter()
                .append("circle")
                .attr("r", 5)
                .attr("cx", d => scaleX(d.label) + scaleX.bandwidth() / 2)
                .attr("cy", d => scaleY(d[value] + 5 * index))
                .attr("transform", `translate(${props.margin.left}, ${props.margin.top})`)
                .style("fill", colors[index]);
        });
    }, [scaleX, scaleY, props.data, props.margin, props.height]);

    return (
        <div className="chart">
            <svg width={props.width} height={props.height}>
                <g ref={axesRef}/>
            </svg>
        </div>
    )
}

/*
Таблица:
- data: данные для таблицы в виде массива объектов
- table-settings: настройки таблицы (сортировка, фильтры, группировка)
- table-content: сама таблица (заголовок и тело)
 */
const Table = props => {

    const [dataTable, setDataTable] = useState(props.data);
    const [headers, setHeaders] = useState(
        Object.keys(dataTable.length > 0 && dataTable[0]).map(label => (
                {key: generateKey(label), label: label}
            )
        )
    );

    const [activePage, setActivePage] = useState("1");
    const changeActive = event => {
        setActivePage(event.target.innerHTML);
    }

    // количество страниц разбиения таблицы
    const pageAmount = Math.ceil(dataTable.length / props.amountRows);

    // массив с номерами страниц
    const pageNumbers = Array.from({length: pageAmount}, (v, i) => i + 1);

    // формируем совокупность span с номерами страниц
    const pages = pageNumbers.map((item, index) =>
        <>
            <span className={
                "pagination "
                + (+item === +activePage ? "active " : "")}
                  onClick={changeActive}
            >
                {item}
            </span>
        </>
    );

    return (
        <div className="content">
            <div className="table-settings">
                <FilterForm filtering={setDataTable}
                            data={props.data}
                            filters={headers}
                />
                <SortForm sorting={setDataTable}
                          data={dataTable}
                          options={headers}
                />
                <GroupFormAndChart grouping={setDataTable}
                                   setHeaders={setHeaders}
                                   data={dataTable}
                                   options={headers}
                                   values={headers.filter(item => typeof dataTable[0][item.label] === "number")}
                />
            </div>
            <div className="table-content">
                <table className="table">
                    {
                        dataTable.length > 0
                        &&
                        <>
                            <TableHead headers={headers}/>
                            <TableBody data={dataTable}
                                       amountRows={props.amountRows}
                                       numPage={activePage}/>
                        </>
                    }
                </table>
                <div>{pages}</div>
            </div>
        </div>
    )
}

/*
Главная компонента, выводится на страницу - контент:
amountRows - ограничение строк таблицы
*/
const Content = () => {
    return (
        <>
            <h1>Composer Data Visualization</h1>
            <Table data={parsedData} amountRows="10"/>
        </>
    )
}

root.render(
    <Content/>
);