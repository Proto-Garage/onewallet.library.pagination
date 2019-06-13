import { Model, Document } from 'mongoose';
export default function retrievePage<TNode = object>(model: Model<Document, {}>, params: {
    first?: number;
    after?: string;
    filter?: {
        [key: string]: any;
    };
}, options?: {
    cursorKey?: string;
    sortDirection?: 1 | -1;
    transform?: <TDocument = Document>(document: TDocument) => TNode | Promise<TNode>;
}): Promise<{
    totalCount: number;
    edges: {
        cursor: string;
        node: TNode;
    }[];
    pageInfo: {
        endCursor: string | null;
        hasNextPage: boolean;
    };
}>;
//# sourceMappingURL=index.d.ts.map