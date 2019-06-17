import { Model, Document } from 'mongoose';
export default function retrievePage<TNode = object, TDocument extends Document = Document>(model: Model<TDocument, {}>, params: {
    first?: number;
    after?: string;
    filter?: {
        [key: string]: any;
    };
}, options?: {
    cursorKey?: string;
    sortDirection?: 1 | -1;
    transform?: (document: TDocument) => TNode | Promise<TNode>;
    totalCount?: boolean;
}): Promise<{
    totalCount?: number;
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