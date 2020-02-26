import * as ts from "typescript";
import {Modifier, SyntaxKind, Token} from "typescript";


// mostly cribbed and hacked from
// https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API
export class Somspiler {
    protected readonly program: ts.Program;
    protected readonly checker: ts.TypeChecker;

    constructor(argv: string[]) {
        this.program = ts.createProgram(argv, {});
        this.checker = this.program.getTypeChecker();
    }

    foo(): void {
        // Visit every sourceFile in the program
        for (const sourceFile of this.program.getSourceFiles()) {
            // SourceFile.isDeclarationFile seems to indicate whether it's in the project or it's in node_modules
            if (!sourceFile.isDeclarationFile) {
                ts.forEachChild(
                    sourceFile,
                    (n) => {
                        return this.visit(n, true);
                    }
                );
            }
        }
    }

    protected handleClass(node: ts.Node) {
    }

    visit(node: ts.Node, onlyExported?: boolean) {
        // Only consider exported nodes
        if (onlyExported && !Somspiler.isNodeExported(node)) {
            return;
        }

        if (ts.isClassDeclaration(node) && node.name) {
            console.log("***** CLASS *****");
            // This is a top level class, get its symbol
            let symbol = this.checker.getSymbolAtLocation(node.name);
            if (symbol) {
                console.log(JSON.stringify(this.serializeClass(symbol)));
            }

            ts.forEachChild(node, this.visit);
        } else if (ts.isModuleDeclaration(node)) {
            // This is a namespace, visit its children
            ts.forEachChild(node, this.visit);
        } else if (ts.isPropertyDeclaration(node)) {
            console.log("***** PROPERTY *****");
            let symbol = this.checker.getSymbolAtLocation(node.name);
            if (node.modifiers && node.modifiers.length > 0) {
                console.log("modifiers: ");
                node.modifiers.forEach((v, i, a) => {
                    console.log(
                        "[" + i + "]: "
                        + (Somspiler.isStatic(v) ? "static " : "")
                        + (Somspiler.isReadonly(v) ? "readonly" : "")
                    );
                });
            }

            if (symbol) {
                console.log(JSON.stringify(this.serializeSymbol(symbol)));
            }
        } else if (ts.isEnumDeclaration(node)) {
            console.log("***** ENUM *****");
            let symbol = this.checker.getSymbolAtLocation(node.name);
            if (symbol) {
                console.log(JSON.stringify(this.serializeSymbol(symbol)));
            }
        }
    }

    /** Serialize a class symbol information */
    serializeClass(symbol: ts.Symbol) {
        let details = this.serializeSymbol(symbol);

        // Get the construct signatures
        let constructorType = this.checker.getTypeOfSymbolAtLocation(
            symbol,
            symbol.valueDeclaration!
        );
        details.constructors = constructorType
        .getConstructSignatures()
        .map(this.serializeSignature);
        return details;
    }

    /** Serialize a signature (call or construct) */
    serializeSignature(signature: ts.Signature) {
        return {
            parameters: signature.parameters.map(this.serializeSymbol),
            returnType: this.checker.typeToString(signature.getReturnType()),
            documentation: ts.displayPartsToString(signature.getDocumentationComment(this.checker))
        };
    }

    /** Serialize a symbol into a json object */
    serializeSymbol(symbol: ts.Symbol): any {
        return {
            name: symbol.getName(),
            flags: symbol.flags.toString(),
            type: this.checker.typeToString(
                this.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!)
            )
        };
    }

    protected static isStatic(m: Modifier): m is Token<SyntaxKind.StaticKeyword> {
        return m.kind === SyntaxKind.StaticKeyword;
    }

    protected static isReadonly(m: Modifier): m is Token<SyntaxKind.ReadonlyKeyword> {
        return m.kind === SyntaxKind.ReadonlyKeyword;
    }

    /** True if this is visible outside this file, false otherwise */
    protected static isNodeExported(node: ts.Node): boolean {
        return (
            (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 ||
            (!!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile)
        );
    }
}

new Somspiler(process.argv);
