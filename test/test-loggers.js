#!/usr/bin/env node

"use strict";

// app-specific requirements
const cll  = require('../lib/commandLineLogger');

const cllLogger = cll.CommandLineLogger();

cllLogger.error("This is an error");
cllLogger.warn("This is a warning");
cllLogger.info("This is information");
// should not see these because it is by default turned off
cllLogger.debug("This is debug, but you should not see me");
cllLogger.verbose("This is vebosity, but you should not see me");

cllLogger.setPrintDebug(true);
cllLogger.setPrintVerbose(true);
cllLogger.debug("This is debug, and you should see me");
cllLogger.verbose("This is vebosity, and you should see me");

cllLogger.setAddSQLComment(true);
cllLogger.error("This is an error with sql comments added");
cllLogger.warn("This is a warning with sql comments added");
cllLogger.info("This is information with sql comments added");


const lml  = require('../lib/listOfMessagesLogger');

const lmLogger = lml.ListOfMessagesLogger();

lmLogger.error("This is an error");
lmLogger.warn("This is a warning");
lmLogger.info("This is information");
// should not see these because it is by default turned off
lmLogger.debug("This is debug, but you should not see me");
lmLogger.verbose("This is vebosity, but you should not see me");

lmLogger.setPrintDebug(true);
lmLogger.setPrintVerbose(true);
lmLogger.debug("This is debug, and you should see me");
lmLogger.verbose("This is vebosity, and you should see me");

console.dir(lmLogger.getMessages());

