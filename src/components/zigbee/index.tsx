import style from "./style.css";
import React, { Component } from "react";
import orderBy from "lodash/orderBy";
import DeviceControlGroup from "../device-control";
import cx from "classnames";
import { Device, SortDirection, DeviceState } from "../../types";
import { genDeviceDetailsLink, lastSeen, toHex } from "../../utils";

import { Notyf } from "notyf";
import PowerSource from "../power-source";
import { connect } from "unistore/react";
import { GlobalState } from "../../store";
import actions from "../../actions";
import ActionTH from "./ActionTH";
import isEqual from "lodash/isEqual";
import { Link } from "react-router-dom";
import DeviceImage from "../device-image";


type SortColumn =
    | "device.network_address"
    | "device.friendly_name"
    | "device.ieee_address"
    | "device.definition.vendor"
    | "device.definition.model"
    | "state.linkquality"
    | "state.last_seen"
    | "state.elapsed"
    | "state.battery";


interface ZigbeeTableState {
    sortDirection: SortDirection;
    sortColumn: SortColumn | SortColumn[];
    currentTime: number;
    sortedTableData: ZigbeeTableData[];
}


interface ZigbeeTableData {
    device: Device;
    state: DeviceState;
}



const storeKey = "ZigbeeTableState";

export class ZigbeeTable extends Component<GlobalState, ZigbeeTableState> {
    constructor(props) {
        super(props);
        this.state = {
            sortDirection: "desc",
            sortColumn: "device.network_address",
            currentTime: Date.now(),
            sortedTableData: []
        };
    }

    restoreState(): void {
        const { sortColumn, sortDirection } = this.state;

        const storedState = localStorage.getItem(storeKey);
        if (storedState) {
            try {
                const restored: Pick<ZigbeeTableState, "sortDirection" | "sortColumn"> = JSON.parse(storedState);
                this.setState(restored);
            } catch (e) {
                new Notyf().error(e.toString());
            }
        } else {
            this.onSortChange(sortColumn, sortDirection);
        }
    }

    saveState = (): void => {
        const { sortDirection, sortColumn } = this.state;
        const storeData = {
            sortDirection,
            sortColumn
        };
        //in private mode localstorage access can throw exceptions
        try {
            localStorage.setItem(storeKey, JSON.stringify(storeData));
        } catch (e) {
            new Notyf().error(e.toString());
        }
    };

    componentDidMount(): void {
        this.restoreState();
    }

    static getDerivedStateFromProps(props: Readonly<GlobalState>, state: ZigbeeTableState): Partial<ZigbeeTableState> {
        const { sortColumn, sortDirection } = state;
        const { devices, deviceStates } = props;
        const tableData: ZigbeeTableData[] = [];
        devices.forEach((device) => {
            if (device.type !== "Coordinator") {
                tableData.push({
                    device,
                    state: deviceStates.get(device.friendly_name)

                });
            }
        });
        return { sortedTableData: orderBy<ZigbeeTableData>(tableData, sortColumn, [sortDirection]) };
    }


    onSortChange = (column: SortColumn | SortColumn[], sortDir: SortDirection = undefined): void => {
        const { sortColumn } = this.state;
        let { sortDirection } = this.state;

        if (isEqual(sortColumn, column)) {
            if (sortDir) {
                sortDirection = sortDir;
            } else if (sortDirection == "asc") {
                sortDirection = "desc";
            } else {
                sortDirection = "asc";
            }
        }

        this.setState({ sortColumn: column, sortDirection }, this.saveState);
    };

    render() {
        const { devices } = this.props;
        if (devices.size) {
            return this.renderDevicesTable();
        }
        return (<div className="h-100 d-flex justify-content-center align-items-center">
            <div className="d-flex align-items-center">
                <strong>Loading, please wait.</strong>
                <div className="spinner-border ml-2" role="status">
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
        </div>);
    }


    renderDevicesTable() {
        const { bridgeInfo } = this.props;
        const { sortColumn, sortDirection, sortedTableData } = this.state;
        const { onSortChange } = this;
        const lastSeenIsAvaliable = bridgeInfo?.config?.advanced?.elapsed || bridgeInfo?.config?.advanced?.last_seen != "disable";
        return (
            <table className={cx("table align-middle", style.adaptive)}>
                <thead>
                    <tr className="text-nowrap">
                        <th>#</th>
                        <th>Pic</th>
                        <ActionTH<SortColumn> className={style["action-column"]} column="device.friendly_name"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>Friendly name</ActionTH>
                        <ActionTH<SortColumn> className={cx(style["action-column"])} column="device.ieee_address"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>IEEE address</ActionTH>
                        <ActionTH<SortColumn> className={cx(style["action-column"])} column="device.definition.vendor"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange} title="definition.vendor">Manufacturer</ActionTH>
                        <ActionTH<SortColumn> className={style["action-column"]} column="device.definition.model"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>Model</ActionTH>
                        <ActionTH<SortColumn> className={style["action-column"]} column="state.linkquality"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>LQI</ActionTH>
                        <ActionTH<SortColumn> className={cx(style["action-column"], { 'd-none': !lastSeenIsAvaliable })} column={["state.last_seen", "state.elapsed"]}
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>Last seen</ActionTH>
                        <ActionTH<SortColumn> className={style["action-column"]} column="state.battery"
                            currentDirection={sortDirection} current={sortColumn}
                            onClick={onSortChange}>Power</ActionTH>
                        <th>&nbsp;</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedTableData.map(({ device, state }, id) =>
                        <tr key={device.friendly_name} title={state?.update?.state == "available" ? 'Avaliable OTA update' : device.definition?.description}>
                            <td className="font-weight-bold">{id + 1}</td>
                            <td className={style["device-pic"]}>
                                <DeviceImage className={cx(style["device-image"])} device={device} />
                            </td>
                            <td>
                                <Link to={genDeviceDetailsLink(device.ieee_address)}>{device.friendly_name}</Link>
                            </td>
                            <td title={toHex(device.network_address)}>{device.ieee_address}</td>
                            <td className={cx("text-truncate", "text-nowrap", "position-relative")}>{device.definition?.vendor ?? 'Unsupported'}</td>
                            <td title={device?.definition?.description}>{device.definition?.model ?? 'Unsupported'}</td>
                            <td>{state?.linkquality ?? "N/A"}</td>
                            <td className={cx({ 'd-none': !lastSeenIsAvaliable })}>{lastSeen(state?.last_seen, state?.elapsed)}</td>
                            <td className="text-left">
                                <PowerSource source={device.power_source} battery={state?.battery} />
                            </td>
                            <td>
                                <DeviceControlGroup device={device} state={state} />
                            </td>
                        </tr>)}

                </tbody>
            </table>
        );
    }
}

const mappedProps = ["devices", "deviceStates", "bridgeInfo"];
const ConnectedZigbeePage = connect<{}, ZigbeeTableState, GlobalState, {}>(mappedProps, actions)(ZigbeeTable);
export default ConnectedZigbeePage;
