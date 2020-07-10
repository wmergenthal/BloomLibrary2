// this engages a babel macro that does cool emotion stuff (like source maps). See https://emotion.sh/docs/babel-macros
import css from "@emotion/css/macro";
// these two lines make the css prop work on react elements
import { jsx } from "@emotion/core";
/** @jsx jsx */
import React, { useState, useMemo } from "react";

import { useGetCollection } from "../../model/Collections";

import { useDocumentTitle } from "../Routes";
import Select from "@material-ui/core/Select";

import { StatsOverviewScreen } from "./StatsOverviewScreen";
import { ComprehensionQuestionsReport } from "./ComprehensionQuestionsReport";
import { ReaderSessionsChart } from "./ReaderSessionsChart";
import { DateRangePicker, IDateRange } from "./DateRangePicker";
import domtoimage from "dom-to-image-more";
import Button from "@material-ui/core/Button";
import { saveAs } from "file-saver";
import DownloadPngIcon from "./download-png.svg";
import DownloadCsvIcon from "./download-csv.svg";
import { IStatsProps, ExportDataFn } from "./StatsInterfaces";
import { useStorageState } from "react-storage-hooks";
import { exportCsv } from "./exportData";
import LinearProgress from "@material-ui/core/LinearProgress";
import { BookReadingReport } from "./BookReadingReport";
import { FormattedMessage, useIntl } from "react-intl";
import { QueryDescription } from "./QueryDescription";

export interface IScreen {
    label: string;
    component: React.FunctionComponent<IStatsProps>;
}
export const Pretend: React.FunctionComponent<IStatsProps> = (props) => {
    return <h1>Pretend</h1>;
};

export const kStatsPageGray = "#ececec";
export const CollectionStatsPage: React.FunctionComponent<{
    collectionName: string;
}> = (props) => {
    const l10n = useIntl();
    const screens: IScreen[] = useMemo(
        () => [
            {
                label: l10n.formatMessage({
                    id: "stats.overview",
                    defaultMessage: "Overview",
                }),
                component: (p: IStatsProps) => <StatsOverviewScreen {...p} />,
            },
            {
                label: l10n.formatMessage({
                    id: "stats.comprehensionQuestions",
                    defaultMessage: "Comprehension Questions",
                }),
                component: (p: IStatsProps) => (
                    <ComprehensionQuestionsReport
                        {...p}
                    ></ComprehensionQuestionsReport>
                ),
            },
            {
                label: l10n.formatMessage({
                    id: "stats.bloomReaderSessions",
                    defaultMessage: "Bloom Reader Sessions",
                }),
                component: (p: IStatsProps) => <ReaderSessionsChart {...p} />,
            },
            {
                label: l10n.formatMessage({
                    id: "stats.booksRead",
                    defaultMessage: "Books Read",
                }),
                component: (p: IStatsProps) => (
                    <BookReadingReport {...p}></BookReadingReport>
                ),
            },
        ],
        [l10n]
    );

    const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
    const [exportDataFn, setExportDataFn] = useState<
        ExportDataFn | undefined
    >();
    const [waiting, setWaiting] = useState(true);
    const [dateRange, setDateRange] = useStorageState<IDateRange>(
        localStorage,
        "analytics-date-range",
        {
            startDate: undefined, // from forever
            endDate: undefined, // today
        }
    );

    // they come back from localStorage as strings.
    if (typeof dateRange.startDate === "string") {
        dateRange.startDate = new Date(dateRange.startDate);
    }
    if (typeof dateRange.endDate === "string") {
        dateRange.endDate = new Date(dateRange.endDate);
    }

    // remains empty (and unused) except in byLanguageGroups mode, when a callback sets it.
    //const [booksAndLanguages, setBooksAndLanguages] = useState("");
    const { collection } = useGetCollection(props.collectionName);
    //const { params, sendIt } = getCollectionAnalyticsInfo(collection);
    useDocumentTitle(collection?.label + " statistics");

    if (!collection) {
        return <div>Collection not found</div>;
    }
    const kSideMarginPx = 20;
    return (
        <div
            css={css`
                margin-left: ${kSideMarginPx}px;
                margin-right: ${kSideMarginPx}px;
                h1 {
                    font-size: 36px;
                    line-height: 28px;
                }
                h2 {
                    margin-block-start: 0;
                    font-size: 24px;
                    line-height: 28px;
                }
            `}
        >
            <h1>{collection?.label}</h1>

            <h2>
                <FormattedMessage
                    id="stats.header"
                    defaultMessage="Bloom Collection Statistics"
                />
            </h2>
            <div
                css={css`
                    //background-color: ${kStatsPageGray};
                    //height: 75px;
                    /* margin-left: -${kSideMarginPx}px; // push back out to the edge
                    margin-right: -${kSideMarginPx}px; // push back out to the edge */
                    padding-top: 20px;
                    padding-bottom: 20px;
                    /* padding-left: ${kSideMarginPx}px;
                    padding-right: ${kSideMarginPx}px; */
                    display: flex;
                    justify-content: space-between;
                `}
            >
                <Select
                    css={css`
                        padding-left: 0;
                        min-width: 300px;
                        &,
                        * {
                            background-color: white !important;
                        }
                    `}
                    native
                    value={currentScreenIndex}
                    onChange={(e) => {
                        // clear the export function when we switch screens. Let the screen call us back with the new function
                        setExportDataFn(undefined);
                        setCurrentScreenIndex(e.target.value as number);
                    }}
                    inputProps={{
                        name: "age",
                        id: "age-native-simple",
                    }}
                >
                    {screens.map((screen, index) => (
                        <option key={index} value={index}>
                            {screen.label}
                        </option>
                    ))}
                </Select>

                <DateRangePicker
                    range={dateRange}
                    setRange={(range) => {
                        setDateRange(range);
                    }}
                ></DateRangePicker>
            </div>
            {/* show this until data is available */}
            {waiting && (
                <LinearProgress
                    css={css`
                        margin-top: 50px;
                        width: 100%;
                    `}
                />
            )}
            <div
                css={css`
                    /* don't display at all until we have data... in the meantime we are showing the progress bar*/
                    display: ${waiting ? "none" : "block"};
                `}
            >
                <div
                    css={css`
                        width: 100%;
                        background-color: ${kStatsPageGray};
                        margin-left: -${kSideMarginPx}px; // push back out to the edge
                        margin-right: -${kSideMarginPx}px; // push back out to the edge
                        padding: ${kSideMarginPx}px;
                    `}
                >
                    <div
                        // This allows horizontal scrolling for the whole 'screen' element...
                        // the chosen block of data. Mainly useful for charts with many columns.
                        css={css`
                            width: 100%;
                            overflow-x: auto;
                        `}
                    >
                        <div
                            id="screen"
                            css={css`
                                width: fit-content; // this is important for image export, else it may be too wide
                                //background-color: white; // this is important for image export, else it's transparent which will confuse people
                            `}
                        >
                            <h3
                                css={css`
                                    margin-block-start: 0;
                                `}
                            >
                                {screens[currentScreenIndex].label}
                            </h3>

                            {screens[currentScreenIndex].component({
                                collection,
                                dateRange,
                                registerExportDataFn: (
                                    fn: ExportDataFn | undefined,
                                    waiting: boolean
                                ) => {
                                    // this double function is to keep react's use state thing from *running* the function,
                                    // which is wants to do!
                                    setExportDataFn(() => fn);
                                    setWaiting(waiting);

                                    // if (fn) {
                                    //     console.log(JSON.stringify(fn()));
                                    // }
                                },
                            })}
                        </div>
                    </div>
                </div>
                <div
                    css={css`
                        display: flex;
                        justify-content: flex-end;
                    `}
                >
                    <Button
                        onClick={() => {
                            downloadAsPng(
                                document.getElementById("screen")!,
                                screens[currentScreenIndex].label + ".png",
                                3
                            );
                        }}
                        aria-label="download PNG image"
                    >
                        <img alt="download PNG" src={DownloadPngIcon} />
                    </Button>
                    {exportDataFn && (
                        <Button
                            onClick={() =>
                                exportCsv(
                                    screens[currentScreenIndex].label,
                                    exportDataFn
                                )
                            }
                        >
                            <img alt="download CSV" src={DownloadCsvIcon} />
                        </Button>
                    )}
                </div>

                <div
                    css={css`
                        padding: 10px;
                    `}
                >
                    <QueryDescription
                        collection={collection}
                        dateRange={dateRange}
                    ></QueryDescription>
                </div>
            </div>
        </div>
    );
};
function downloadAsPng(el: HTMLElement, filename: string, scale: number) {
    const props = {
        width: el.clientWidth * scale,
        height: el.clientHeight * scale,
        style: {
            transform: "scale(" + scale + ")",
            "transform-origin": "top left",
        },
    };
    domtoimage.toPng(el, props).then((blob) => {
        saveAs(blob, filename);
    });
}
