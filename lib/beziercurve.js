/*
Copyright 2008-2010 Gephi
Authors : Mathieu Bastian <mathieu.bastian@gephi.org>
Website : http://www.gephi.org

This file is part of Gephi.

DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS HEADER.

Copyright 2011 Gephi Consortium. All rights reserved.

The contents of this file are subject to the terms of either the GNU
General Public License Version 3 only ("GPL") or the Common
Development and Distribution License("CDDL") (collectively, the
"License"). You may not use this file except in compliance with the
License. You can obtain a copy of the License at
http://gephi.org/about/legal/license-notice/
or /cddl-1.0.txt and /gpl-3.0.txt. See the License for the
specific language governing permissions and limitations under the
License.  When distributing the software, include this License Header
Notice in each file and include the License files at
/cddl-1.0.txt and /gpl-3.0.txt. If applicable, add the following below the
License Header, with the fields enclosed by brackets [] replaced by
your own identifying information:
"Portions Copyrighted [year] [name of copyright owner]"

If you wish your version of this file to be governed by only the CDDL
or only the GPL Version 3, indicate your decision by adding
"[Contributor] elects to include this software in this distribution
under the [CDDL or GPL Version 3] license." If you do not indicate a
single choice of license, a recipient has the option to distribute
your version of this file under either the CDDL, the GPL Version 3 or
to extend the choice of license to its licensees as provided above.
However, if you add GPL Version 3 code and therefore, elected the GPL
Version 3 license, then the option applies only if the new code is
made subject to such option by the copyright holder.

Contributor(s):

Portions Copyrighted 2011 Gephi Consortium.
 */

/**
 * Bezier curve interpolator.
 * <p>
 * Basically, a cubic Bezier curve is created with start point (0,0) and
 * endpoint (1,1).  The other two control points (px1, py1) and (px2, py2) are
 * given by the user, where px1, py1, px1, and px2 are all in the range [0,1].
 * </p>
 */
//Author David C. Browne
var BezierCurve = module.exports = (function() {

var SAMPLE_SIZE = 16;
var SAMPLE_INCREMENT = 1.0 / SAMPLE_SIZE;

function BezierCurve(x1, y1, x2, y2) {
    // if (x1 < 0 || x1 > 1 || y1 < 0 || y1 > 1 || x2 < 0 || x2 > 1 || y2 < 0 || y2 > 1) {
    //     throw new Error("control point coordinates must all be in range [0,1]");
    // }

    this.x1 = x1;
    this.x2 = x2;
    this.y1 = y1;
    this.y2 = y2;

    // calc linearity/identity curve
    this.linear = (x1 == y1) && (x2 == y2);

    // make the array of x value samples
    this.xSamples = [];
    if (!this.linear) {
        for (var i = 0; i <= SAMPLE_SIZE; ++i) {
            this.xSamples[i] = this.eval(i * SAMPLE_INCREMENT, x1, x2);
        }
    }
}

/**
 * get the y-value of the cubic bezier curve that corresponds to the x input
 * @param x is x-value of cubic bezier curve, in range [0,1]
 * @return corresponding y-value of cubic bezier curve -- in range [0,1]
 */
BezierCurve.prototype.interpolate = function(x) {
    // check user input for precondition
    if (x < 0) x = 0;
    else if (x > 1) x = 1;

    // check quick exit identity cases (linear curve or curve endpoints)
    if (this.linear || x == 0 || x == 1) return x;

    // find the t parameter for a given x value, and use this t to calculate
    // the corresponding y value
    return this.eval(this.findTForX(x), this.y1, this.y2);
};


/**
 * use Bernstein basis to evaluate 1D cubic Bezier curve (quicker and more
 * numerically stable than power basis) -- 1D control coordinates are
 * (0, p1, p2, 1), where p1 and p2 are in range [0,1], and there is no
 * ordering constraint on p1 and p2, i.e., p1 <= p2 does not have to be true
 * @param t is the paramaterized value in range [0,1]
 * @param p1 is 1st control point coordinate in range [0,1]
 * @param p2 is 2nd control point coordinate in range [0,1]
 * @return the value of the Bezier curve at parameter t
 */
BezierCurve.prototype.eval = function(t, p1, p2) {
    // Use optimzied version of the normal Bernstein basis form of Bezier:
    // (3*(1-t)*(1-t)*t*p1)+(3*(1-t)*t*t*p2)+(t*t*t), since p0=0, p3=1
    // The above unoptimized version is best using -server, but since we are
    // probably doing client-side animation, this is faster.
    var compT = 1 - t;
    return t * (3 * compT * (compT * p1 + t * p2) + (t * t));
};

/**
 * evaluate Bernstein basis derivative of 1D cubic Bezier curve, where 1D
 * control points are (0, p1, p2, 1), where p1 and p2 are in range [0,1], and
 * there is no ordering constraint on p1 and p2, i.e., p1 <= p2 does not have
 * to be true
 * @param t is the paramaterized value in range [0,1]
 * @param p1 is 1st control point coordinate in range [0,1]
 * @param p2 is 2nd control point coordinate in range [0,1]
 * @return the value of the Bezier curve at parameter t
 */
BezierCurve.prototype.evalDerivative = function(t, p1, p2) {
    // use optimzed version of Berstein basis Bezier derivative:
    // (3*(1-t)*(1-t)*p1)+(6*(1-t)*t*(p2-p1))+(3*t*t*(1-p2)), since p0=0, p3=1
    // The above unoptimized version is best using -server, but since we are
    // probably doing client-side animation, this is faster.
    var compT = 1 - t;
    return 3 * (compT * (compT * p1 + 2 * t * (p2 - p1)) + t * t * (1 - p2));
};

/**
 * find an initial good guess for what parameter t might produce the x-value
 * on the Bezier curve -- uses linear interpolation on the x-value sample
 * array that was created on construction
 * @param x is x-value of cubic bezier curve, in range [0,1]
 * @return a good initial guess for parameter t (in range [0,1]) that gives x
 */
BezierCurve.prototype.getInitialGuessForT = function(x) {
    // find which places in the array that x would be sandwiched between,
    // and then linearly interpolate a reasonable value of t -- array values
    // are ascending (or at least never descending) -- binary search is
    // probably more trouble than it is worth here
    for (var i = 1; i <= SAMPLE_SIZE; ++i) {
        if (this.xSamples[i] >= x) {
            var xRange = this.xSamples[i] - this.xSamples[i - 1];
            if (xRange == 0) {
                // no change in value between samples, so use earlier time
                return (i - 1) * SAMPLE_INCREMENT;
            } else {
                // linearly interpolate the time value
                return ((i - 1) + ((x - this.xSamples[i - 1]) / xRange))
                        * SAMPLE_INCREMENT;
            }
        }
    }

    // shouldn't get here since 0 <= x <= 1, and xSamples[0] == 0 and
    // xSamples[SAMPLE_SIZE] == 1 (using power of 2 SAMPLE_SIZE for more
    // exact increment arithmetic)
    return 1;
};

/**
 * find the parameter t that produces the given x-value for the curve --
 * uses Newton-Raphson to refine the value as opposed to subdividing until
 * we are within some tolerance
 * @param x is x-value of cubic bezier curve, in range [0,1]
 * @return the parameter t (in range [0,1]) that produces x
 */
BezierCurve.prototype.findTForX = function(x) {
    // get an initial good guess for t
    var t = this.getInitialGuessForT(x);

    // use Newton-Raphson to refine the value for t -- for this constrained
    // Bezier with float accuracy (7 digits), any value not converged by 4
    // iterations is cycling between values, which can minutely affect the
    // accuracy of the last digit
    var numIterations = 4;
    for (var i = 0; i < numIterations; ++i) {
        // stop if this value of t gives us exactly x
        var xT = (this.eval(t, this.x1, this.x2) - x);
        if (xT == 0) {
            break;
        }

        // stop if derivative is 0
        var dXdT = this.evalDerivative(t, this.x1, this.x2);
        if (dXdT == 0) {
            break;
        }

        // refine t
        t -= xT / dXdT;
    }

    return t;
};

return BezierCurve;

})();
