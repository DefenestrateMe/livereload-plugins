"use strict";

var assert = require("assert");
var core = require("./core");
var is = require("simple-is");

function getline(node) {
	return node.loc.start.line;
}

function isFunction(node) {
	var type;
	return node && (type = node.type)
		&& type === "FunctionDeclaration" || type === "FunctionExpression" || type === "ArrowFunctionExpression";
}

function isLoop(node) {
	var type;
	return node && (type = node.type)
		&& type === "ForStatement" || type === "ForInStatement" || type === "ForOfStatement" || type === "WhileStatement" || type === "DoWhileStatement";
}

function isObjectPattern(node) {
	return node && node.type === 'ObjectPattern';
}

function isArrayPattern(node) {
	return node && node.type === 'ArrayPattern';
}


var plugin = module.exports = {
	reset: function() {

	}

	, setup: function(alter, ast, options) {
		if( !this.__isInit ) {
			this.reset();
			this.__isInit = true;
		}

		this.alter = alter;
		this.options = options;

		var resetUnCapturedVariables = options.resetUnCapturedVariables;

		return Array.isArray(resetUnCapturedVariables) && resetUnCapturedVariables.length > 1 || false;
	}

	, ':: VariableDeclaration': function(node) {
		core.getVariableDeclarationNodes(node).forEach(function(declarationNode) {
			if( !declarationNode.$captured ) {
				this.resetVariable(
					declarationNode
					, null
				);
			}
		}, this);
	}

	, ':: FunctionDeclaration': function(node) {
		this.resetVariable(node.id, "fun", node.$scope.parent.node);
	}

	, ':: Identifier': function(node) {
		if( node.$refToScope ) {
			if( node.$captured === false ) {
				this.resetVariable(node);
			}
		}
	}

	, resetVariable: function(node, kind, scopeNode) {
		if( node.$captured ) {
			return;
		}

		var name = node.name;
		kind = kind || node.$originalKind || (node.$refToScope && node.$refToScope.getKind(name)) || node.kind || node.$scope.closestHoistScope().getKind(name);

		if( !is.someof(kind, this.options.resetUnCapturedVariables) ) {
			return;
		}

		scopeNode = scopeNode || (node.$refToScope && node.$refToScope.node) || node.$scope.node;

		if( kind === 'var' || kind === 'fun' ) {
			scopeNode = scopeNode.$scope.closestHoistScope().node;
		}

		if( isLoop(scopeNode.$parent) && scopeNode.$parent.$iify === true ) {
			// TODO:: allow reset variables inside IIFY (it's buggy now)
			return;
		}

		var insertIndex = scopeNode.range[1] + (isLoop(scopeNode) ? 0 : (scopeNode.type === "Program" ? 0 : -1));

//		if( !isFunction(scopeNode) ) {
			if( !scopeNode.$voidsInsert ) {
				scopeNode.$voidsInsert = {};
			}
			if( scopeNode.$voidsInsert[name] === void 0 ) {
				scopeNode.$voidsInsert[name] = null;

				this.alter.insertBefore(
					insertIndex
					, ";" + name + " = void 0;"
				);
			}
//		}
//		else {
			// TODO::
			// function test(){ let a = {}; return; } -> function test(){ var a = {}; a = void 0;return; }
			// function test(){ let a = {}; return a; } -> function test(){ var a = {}; return; }
//		}
	}
};

for(var i in plugin) if( plugin.hasOwnProperty(i) && typeof plugin[i] === "function" ) {
	plugin[i] = plugin[i].bind(plugin);
}
