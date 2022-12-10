//__BEGIN_LICENSE__
// Copyright (c) 2017, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The GeoRef platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

var geocamTiePoint = window.geocamTiePoint || {};
geocamTiePoint.transform = {};

$(function($) {

    function matrixFromNestedList(nestedList) {
        var height = nestedList.length;
        var width = nestedList[0].length;
        return new Matrix(width, height, nestedList);
    }

    function columnVectorFromPt(pt) {
        return new Matrix(1, 3,
                          [[pt[0]],
                           [pt[1]],
                           [1]]);
    }

    function quadraticColumnVectorFromPt(pt) {
        return new Matrix(1, 5,
                          [[pt[0] * pt[0]],
                           [pt[1] * pt[1]],
                           [pt[0]],
                           [pt[1]],
                           [1]]);
    }

    function ptFromColumnVector(v) {
        var z = v.values[2][0];
        return [v.values[0][0] / z,
                v.values[1][0] / z];
    }

    function forwardPoints(tform, fromPts) {
        var toPts = new Matrix(fromPts.w, fromPts.h);
        var n = fromPts.w;
        for (var i = 0; i < n; i++) {
            var x = fromPts.values[0][i];
            var y = fromPts.values[1][i];
            var out = tform.forward([x, y]);
            toPts.values[0][i] = out[0];
            toPts.values[1][i] = out[1];
        }
        return toPts;
    }

    function linearLeastSquares(V, U) {
        var tmp = U.transpose().multiply(V);
        return U.transpose().multiply(U).invert().multiply(tmp);
    }

    function leastSquares(y, f, x0) {
        var result = geocamTiePoint.optimize.lm(y, f, x0);
        return result[0];
    }

    function splitPoints(points) {
        var n = points.length;
        var toPts = new Matrix(n, 2);
        var fromPts = new Matrix(n, 2);
        for (var i = 0; i < n; i++) {
            toPts.values[0][i] = points[i][0];
            toPts.values[1][i] = points[i][1];
            fromPts.values[0][i] = points[i][2];
            fromPts.values[1][i] = points[i][3];
        }
        return [toPts, fromPts];
    }

    function vectorBetweenFirstTwoPoints(pts) {
        var x0 = pts.values[0][0];
        var y0 = pts.values[1][0];
        var x1 = pts.values[0][1];
        var y1 = pts.values[1][1];
        return [x1 - x0, y1 - y0];
    }

    function norm(v) {
        return Math.sqrt(v[0] * v[0] +
                         v[1] * v[1]);
    }

    function angle(v) {
        return Math.atan2(v[1], v[0]);
    }

    /**********************************************************************
     * Transform
     **********************************************************************/

    function Transform() {}

    Transform.fit = function(cls, toPts, fromPts) {
        var params0 = cls.getInitParams(toPts, fromPts);
        // console.log('fit: params0: ' + JSON.stringify(params0));
        var params = (leastSquares
                      (toPts.flatten(),
                       function(params) {
                           return (forwardPoints(cls.fromParams(params),
                                                 fromPts)
                                   .flatten());
                       },
                       params0));
        //console.log('fit: params: ' + JSON.stringify(params));
        return params;
    };
    
    /**********************************************************************
     * LinearTransform
     **********************************************************************/

    function LinearTransform(matrix) {
        this.matrix = matrix;
    }

    LinearTransform.prototype = $.extend(true,
                                         {},
                                         Transform.prototype);

    LinearTransform.prototype.forward = function(pt) {
        var u = columnVectorFromPt(pt);
        var v = this.matrix.multiply(u);
        return ptFromColumnVector(v);
    };

    LinearTransform.prototype.toDict = function() {
        return {
            type: 'projective',
            matrix: this.matrix.values
        };
    };

    /**********************************************************************
     * AffineTransform
     **********************************************************************/

    function AffineTransform(matrix) {
        this.matrix = matrix;
    }

    AffineTransform.prototype = $.extend(true,
                                         {},
                                         LinearTransform.prototype);

    AffineTransform.fit = function(cls, toPts, fromPts) {
        var n = toPts.w;
        var V = new Matrix(1, 2 * n);
        var U = new Matrix(6, 2 * n);
        for (var i = 0; i < n; i++) {
            V.values[2 * i][0] = toPts.values[0][i];
            V.values[2 * i + 1][0] = toPts.values[1][i];

            U.values[2 * i][0] = fromPts.values[0][i];
            U.values[2 * i][1] = fromPts.values[1][i];
            U.values[2 * i][2] = 1;
            U.values[2 * i + 1][3] = fromPts.values[0][i];
            U.values[2 * i + 1][4] = fromPts.values[1][i];
            U.values[2 * i + 1][5] = 1;
        }
        var p = linearLeastSquares(V, U);
        return [p.values[0][0],
                 p.values[1][0],
                p.values[2][0],
                p.values[3][0],
                p.values[4][0],
                p.values[5][0]];
    };

    AffineTransform.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [0, 0, 1]]);
        return new AffineTransform(matrix);
    };


    /**********************************************************************
     * Camera Model Transform
     **********************************************************************/
  
//    function CameraModelTransform(params, imageId) {
//    	this.params = params;
//    	this.imageId = imageId;
//    }
//    
//    CameraModelTransform.prototype = $.extend(true,
//            {},
//            Transform.prototype);
//
//    CameraModelTransform.fromParams = function(params, imageId) {
//    	return new CameraModelTransform(params, imageId);
//    };
//
//    //TODO look at this code and remove if unused.  Should save through overlay.warp.
//    CameraModelTransform.fit = function(cls, toPts, fromPts, imageId, overlay) {
//    	/**
//    	 * Sends a request to the server and retrieves 
//    	 * optimized params (iss pose, orientation, focal len, etc)
//    	 * for registration in JSON.
//    	 */
//    	if (imageId === 'undefined') {
//    		// for now, raise an exception. Later use another form of transform 
//    		// that doens't depend on the iss image id.
//    		alert("CameraModelTransform.fit: imageId is undefined! ", imageId);
//    		return;
//    	}
//    	var pts = {"imageId": imageId, "toPts": toPts.values, "fromPts": fromPts.values};
//    	// make a call to the server with toPts, fromPts, and imageId.
//    	$.ajax({
//    		type: 'POST', 
//    		url: cameraModelTransformFitUrl,
//    		data: pts, 
//    		success: function(data){
//    			overlay.set('transform', {type: 'CameraModelTransform', params: data['params'], imageId: imageId});
//    			// need to save again to backbone so that overlayIdJson post is triggered with new transform.
//                saveOptions = {
//                    error: function(model, response) {
//                        if (response.readyState < 4) {
//                            model.trigger('warp_server_unreachable');
//                        } else {
//                            model.trigger('warp_server_error');
//                        }
//                    },
//                    success: function(model, response) {
//                        model.trigger('warp_success');
//                    }
//                };
//                overlay.save(saveOptions);
////    			Backbone.Model.prototype.save.call(overlay, {},
////    												saveOptions);
//    		},
//    		error: function() { alert("CameraModelTransform: could not return transform from fit "); }, 
//    		dataType: "json"
//    	});
//    };
//    
//    CameraModelTransform.prototype.forward = function(pt) {
//    	// set updateCenter to false if it is not defined.
//    	var data = {'pt': [pt.x, pt.y], 'params': this.params, 'imageId': this.imageId}
//    	$.ajax({
//    		type: 'POST',
//    		url: cameraModelTransformForwardUrl,
//    		data: data,
//    		success: function(data) {
//    			var ptInMeters = data['meters'];
//				ptInMeters.x = ptInMeters[0];
//				ptInMeters.y = ptInMeters[1];
//				var pt = metersToLatLon(ptInMeters);
//    			return ptInMeters;
//    		},
//    		error: function() { 
//    			console.log("CameraModelTransform: could not convert pixel coords to meters!"); 
//    		},
//    		dataType: "json"
//    	});
//    };
//    
//    CameraModelTransform.prototype.toDict = function() {
//        return {
//            type: 'CameraModelTransform',
//            params: this.params,
//            imageId: this.imageId
//        };
//    };
    
    
    /**********************************************************************
     * RotateScaleTranslateTransform
     **********************************************************************/

    function RotateScaleTranslateTransform(matrix) {
        this.matrix = matrix;
    }

    (RotateScaleTranslateTransform.prototype =
     $.extend(true,
              {},
              LinearTransform.prototype));

    RotateScaleTranslateTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new RotateScaleTranslateTransform(matrix);
    };

    RotateScaleTranslateTransform.fromParams = function(p) {
        var tx = p[0];
        var ty = p[1];
        var scale = p[2];
        var theta = p[3];

        var translateMatrix = new Matrix(3, 3,
                                         [[1, 0, tx],
                                          [0, 1, ty],
                                          [0, 0, 1]]);
        var scaleMatrix = new Matrix(3, 3,
                                     [[scale, 0, 0],
                                      [0, -scale, 0],
                                      [0, 0, 1]]);
        var rotateMatrix = new Matrix(3, 3,
                                      [[Math.cos(theta), -Math.sin(theta), 0],
                                       [Math.sin(theta), Math.cos(theta), 0],
                                       [0, 0, 1]]);
        var matrix = (translateMatrix
                      .multiply(scaleMatrix)
                      .multiply(rotateMatrix));
        return new RotateScaleTranslateTransform(matrix);
    };

    RotateScaleTranslateTransform.getInitParams = function(toPts, fromPts) {
        var centroidDiff = toPts.meanColumn().subtract(fromPts.meanColumn());
        var tx = centroidDiff.values[0][0];
        var ty = centroidDiff.values[1][0];

        var toVec = vectorBetweenFirstTwoPoints(toPts);
        var fromVec = vectorBetweenFirstTwoPoints(fromPts);
        var scale = norm(toVec) / norm(fromVec);
        var theta = angle(toVec) - angle(fromVec);

        return [tx, ty, scale, theta];
    };

    RotateScaleTranslateTransform.fit = Transform.fit;

    /**********************************************************************
     * ProjectiveTransform
     **********************************************************************/

    function ProjectiveTransform(matrix) {
        this.matrix = matrix;
    }

    ProjectiveTransform.prototype = $.extend(true,
                                             {},
                                             LinearTransform.prototype);

    ProjectiveTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new ProjectiveTransform(matrix);
    };

    ProjectiveTransform.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [p[6], p[7], 1]]);
        return new ProjectiveTransform(matrix);
    };

    ProjectiveTransform.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);
        return p.concat([0, 0]);
    };

    ProjectiveTransform.fit = Transform.fit;

    /**********************************************************************
     * QuadraticTransform
     **********************************************************************/

    function QuadraticTransform(matrix) {
        this.matrix = matrix;
    }

    QuadraticTransform.prototype = $.extend(true,
                                            {},
                                            Transform.prototype);

    QuadraticTransform.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new QuadraticTransform(matrix);
    };

    QuadraticTransform.fromParams = function(p) {
        var matrix = new Matrix(5, 3,
                                [[p[0], p[1], p[2], p[3], p[4]],
                                 [p[5], p[6], p[7], p[8], p[9]],
                                 [0, 0, p[10], p[11], 1]]);
        return new QuadraticTransform(matrix);
    };

    QuadraticTransform.getInitParams = function(toPts, fromPts) {
        var p = AffineTransform.fit(AffineTransform, toPts, fromPts);
        return [0, 0, p[0], p[1], p[2],
                0, 0, p[3], p[4], p[5],
                0, 0];
    };

    QuadraticTransform.fit = Transform.fit;

    QuadraticTransform.prototype.forward = function(pt) {
        var u = quadraticColumnVectorFromPt(pt);
        var v = this.matrix.multiply(u);
        return ptFromColumnVector(v);
    };

    QuadraticTransform.prototype.toDict = function() {
        return {
            type: 'quadratic',
            matrix: this.matrix.values
        };
    };

    /**********************************************************************
     * QuadraticTransform2
     **********************************************************************/

    /* QuadraticTransform2 is similar to QuadraticTransform but modified
     * slightly to make it easy to invert analytically (see //
     * transform.py). The modification introduces some 4th and 6th order
     * terms that should not make much difference in practice.
     *
     * In order to improve numerical stability when fitting tie points,
     * the forward transfrom output is rescaled by a factor of SCALE at
     * the last step. Thus the entries in the matrix will be much
     * smaller than for the other Transform types. */

    function QuadraticTransform2(matrix, quadraticTerms) {
        this.matrix = matrix;
        this.quadraticTerms = quadraticTerms;
    }

    QuadraticTransform2.prototype = $.extend(true,
                                             {},
                                             Transform.prototype);

    QuadraticTransform2.fromDict = function(transformDict) {
        var matrix = matrixFromNestedList(transformDict.matrix);
        return new QuadraticTransform2(matrix,
                                       transformDict.quadraticTerms);
    };

    QuadraticTransform2.fromParams = function(p) {
        var matrix = new Matrix(3, 3,
                                [[p[0], p[1], p[2]],
                                 [p[3], p[4], p[5]],
                                 [p[6], p[7], 1]]);
        var quadraticTerms = [p[8], p[9], p[10], p[11]];
        return new QuadraticTransform2(matrix, quadraticTerms);
    };

    var SCALE = 1e+7;

    QuadraticTransform2.getInitParams = function(toPts, fromPts) {
        // pre-conditioning by SCALE improves numerical stability
        var toPtsConditioned = toPts.multiply(1.0 / SCALE);
        var p = AffineTransform.fit(AffineTransform, toPtsConditioned, fromPts);
        return p.concat([0, 0, 0, 0, 0, 0]);
    };

    QuadraticTransform2.fit = Transform.fit;

    QuadraticTransform2.prototype.forward = function(pt) {
        var u = columnVectorFromPt(pt);
        var v0 = this.matrix.multiply(u);
        var v1 = ptFromColumnVector(v0);

        var x = v1[0];
        var y = v1[1];

        var a = this.quadraticTerms[0];
        var b = this.quadraticTerms[1];
        var c = this.quadraticTerms[2];
        var d = this.quadraticTerms[3];

        var p = x + a * x * x;
        var q = y + b * y * y;
        var r = p + c * q * q;
        var s = q + d * r * r;

        // correct for pre-conditioning
        r = r * SCALE;
        s = s * SCALE;

        return [r, s];
    };

    QuadraticTransform2.prototype.toDict = function() {
        return {
            type: 'quadratic2',
            matrix: this.matrix.values,
            quadraticTerms: this.quadraticTerms
        };
    };

    /**********************************************************************
     * top-level functions
     **********************************************************************/
    function getTransformClass(n) {
        if (n < 2) {
            throw 'not enough tie points';
        } else if (n == 2) {
            return RotateScaleTranslateTransform;
        } else if (n == 3) {
            return AffineTransform;
        } else if (n < 7) {
            return ProjectiveTransform;
        } else {
            return QuadraticTransform2;
        }
    }
//    function getTransformClass(n) {
//    	if (n < 2) {
//            throw 'not enough tie points';
//        } else if (n == 2) {
//        	console.log("n is 2 so get the CameraModelTransform");
//        	return CameraModelTransform;
//        } else if (n == 3) {
//        	console.log("n is 3 so get the CameraModelTransform");
//        	return CameraModelTransform;
//        } else if (n < 7) {
//        	console.log("n is "+n+" so get the ProjectiveTransform");
//            return ProjectiveTransform;
//        } else {
//            return QuadraticTransform2;
//        }
//    }

    function getTransform(points, issMRF, overlay) {
        var s = splitPoints(points);
        var toPts = s[0];
        var fromPts = s[1];
        var n = toPts.w;
        var cls = getTransformClass(n);
        var params = null;
//        if (((cls == CameraModelTransform) && (typeof issMRF != 'undefined'))
//        		&& (typeof overlay != 'undefined')){
//        	//only pass the issMRF field if it is a cameraModelTransform
//        	cls.fit(cls, toPts, fromPts, issMRF, overlay); 
//        } else {
        params = cls.fit(cls, toPts, fromPts);
        return cls.fromParams(params);
//        }
    }
    

    function deserializeTransform(transformJSON) {
        var classmap = {
            'projective': ProjectiveTransform,
            'quadratic': QuadraticTransform,
            'quadratic2': QuadraticTransform2//,
//            'CameraModelTransform': CameraModelTransform
        };
        if (! transformJSON.type in classmap) {
            throw 'Unexpected transform type';
        }
        var transformClass = classmap[transformJSON.type];
        if (transformClass === QuadraticTransform2) {
            return new transformClass(matrixFromNestedList
                                      (transformJSON.matrix),
                                      transformJSON.quadraticTerms);
//        } else if (transformClass === CameraModelTransform) {
//        	return new transformClass(transformJSON.params, transformJSON.imageId);
        } else {
            return new transformClass(matrixFromNestedList
                                      (transformJSON.matrix));
        }
    }

    /**********************************************************************
     * exports
     **********************************************************************/

    var ns = geocamTiePoint.transform;
    ns.getTransform = getTransform;
    ns.splitPoints = splitPoints;
    ns.forwardPoints = forwardPoints;
    ns.deserializeTransform = deserializeTransform;
});
