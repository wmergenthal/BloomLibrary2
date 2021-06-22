import React, { useMemo } from "react";
import { useGetBooksForGrid } from "../../connection/LibraryQueryHooks";
import {
    Grid,
    Table,
    TableHeaderRow,
} from "@devexpress/dx-react-grid-material-ui";
import {
    Sorting,
    SortingState,
    IntegratedSorting,
} from "@devexpress/dx-react-grid";
import { ICollectionReportProps } from "./CollectionReportSplit";
import { IGridColumn } from "../Grid/GridColumns";
import { useIntl } from "react-intl";
import { useGetCollection } from "../../model/Collections";
import { PageNotFound } from "../PageNotFound";

interface IBookReport {
    languages: string;
    title: string;
    originalTitle: string;
    allTitles: string;
    originalPublisher: string;
    publisher: string;
    blorgLink: string;
    startedCount: number;
    downloads: number;
    uploadDate: string;
}

const reportBookKeys =
    "objectId,bookInstanceId," +
    "title,allTitles,originalTitle,publisher,originalPublisher,langPointers";

function extractBookReportFromRawData(
    book: any,
    collectionName: string
): IBookReport {
    const report: IBookReport = {
        languages: book.languages
            .map((lang: any) => {
                return `${lang.name} (${lang.isoCode})`;
            })
            .join(", "),
        title: book.title,
        originalTitle: book.originalTitle,
        allTitles: book.allTitlesRaw,
        originalPublisher: book.originalPublisher,
        publisher: book.publisher,
        blorgLink: `https://bloomlibrary.org/${collectionName}/book/${book.objectId}`,
        startedCount: parseInt(book.stats?.startedCount, 10) || 0,
        downloads:
            (parseInt(book.stats?.shellDownloads, 10) || 0) +
            (parseInt(book.stats?.pdfDownloads, 10) || 0) +
            (parseInt(book.stats?.epubDownloads, 10) || 0) +
            (parseInt(book.stats?.bloomPubDownloads, 10) || 0),
        uploadDate: book.uploadDate!.toLocaleDateString(),
    };
    return report;
}

export const CollectionReport: React.FunctionComponent<ICollectionReportProps> = (
    props
) => {
    const l10n = useIntl();

    const kBooksPerPage = 1000000; // effectively unlimited
    let sortings: ReadonlyArray<Sorting> = [];
    const { collection, loading } = useGetCollection(props.collectionName);
    const doNotRunQuery = loading || !collection?.filter;
    const {
        onePageOfMatchingBooks: matchingBooks,
        totalMatchingBooksCount,
    } = useGetBooksForGrid(
        collection?.filter ?? {},
        kBooksPerPage,
        0,
        sortings.map((s) => ({
            columnName: s.columnName,
            descending: s.direction === "desc",
        })),
        reportBookKeys,
        doNotRunQuery
    );
    const haveBooks: boolean = !!(matchingBooks && matchingBooks.length);
    let bookData: IBookReport[] = [];
    if (haveBooks) {
        bookData = matchingBooks.map((b: any) => {
            return extractBookReportFromRawData(
                b,
                props.collectionName.toLowerCase()
            );
        });
    }
    const columns: IGridColumn[] = [
        { name: "languages", title: "Languages", l10nId: "languages" },
        { name: "title", title: "Primary Title" },
        { name: "originalTitle", title: "Original Title" },
        { name: "allTitles", title: "All Titles" },
        { name: "originalPublisher", title: "Original Publisher" },
        { name: "publisher", title: "Publisher" },
        { name: "blorgLink", title: "Bloom Library Link" },
        { name: "startedCount", title: "Reads", l10nId: "stats.reads" },
        { name: "downloads", title: "Downloads", l10nId: "downloads" },
        { name: "uploadDate", title: "Original Upload Date" },
    ];
    // localize
    columns.forEach((c) => {
        const s = l10n.formatMessage({
            id: c.l10nId ?? `report.${c.name}`,
            defaultMessage: c.title,
        });
        c.title = s;
    });

    const result = useMemo(() => {
        const loadingStatement = l10n.formatMessage({
            id: "loading",
            defaultMessage: "Loading...",
        });
        if (loading) {
            return <div style={{ height: "2000px" }}>{loadingStatement}</div>;
        }
        if (!collection) {
            return <PageNotFound />;
        }
        // Doing this explicitly using the count we already have display much sooner
        // than using <BookCount filter=.../> and waiting for another query to round-trip.
        const summaryCount = l10n.formatMessage(
            {
                id: "bookCount",
                defaultMessage: "{count} books",
            },
            {
                count: totalMatchingBooksCount,
            }
        );
        return (
            <div>
                {totalMatchingBooksCount >= 0 && (
                    <div>
                        <h1>{collection.label}</h1>
                        <p>{summaryCount}</p>
                    </div>
                )}
                {(totalMatchingBooksCount < 0 ||
                    (!haveBooks && totalMatchingBooksCount > 0)) && (
                    <div>{loadingStatement}</div>
                )}
                {haveBooks && (
                    <Grid rows={bookData} columns={columns}>
                        <SortingState
                            defaultSorting={[
                                { columnName: "title", direction: "asc" },
                            ]}
                        />
                        <IntegratedSorting /> <Table />
                        <TableHeaderRow />
                    </Grid>
                )}
            </div>
        );
    }, [
        collection,
        loading,
        totalMatchingBooksCount,
        bookData,
        columns,
        haveBooks,
        l10n,
    ]);
    return result;
};

// though we normally don't like to export defaults, this is required for react.lazy (code splitting)
export default CollectionReport;
