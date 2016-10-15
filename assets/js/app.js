$(function () {
	"use strict";

	$("#menuToggle, .btn-close").on("click", function (e) {
		e.preventDefault();
	});

	$('.dropdown-menu a').click(function(e) {
		e.stopPropagation();
	});

	function getGridSize() {
		return (Modernizr.mq('(max-width:490px)')) ? 1 :
				(Modernizr.mq('(max-width:705px)')) ? 2 :
				(Modernizr.mq('(max-width:768px)')) ? 3 : 4;
	}

	/* ---------------------------------------------------------
	 *	Background
	 */

	$.backstretch([
		"assets/img/background/1.jpg",
		"assets/img/background/2.jpg",
		"assets/img/background/3.jpg",
		"assets/img/background/4.jpg",
		"assets/img/background/5.jpg",
		"assets/img/background/6.jpg",
		"assets/img/background/7.jpg",
		"assets/img/background/8.jpg",
		"assets/img/background/9.jpg",
		"assets/img/background/10.jpg",
		"assets/img/background/11.jpg",
		"assets/img/background/12.jpg",
		"assets/img/background/13.jpg",

	], {duration: 3800, fade: 1500});

	/* ---------------------------------------------------------
	 *	Stars
	 */

	$(".stars-three").html("<i class=\"fa fa-star\"></i><i class=\"fa fa-star\"></i><i class=\"fa fa-star\"></i>&nbsp;");
	$(".stars-two-half").html("<i class=\"fa fa-star\"></i><i class=\"fa fa-star\"></i><i class=\"fa fa-star-half-o\"></i>&nbsp;");
	$(".stars-two").html("<i class=\"fa fa-star\"></i><i class=\"fa fa-star\"></i><i class=\"fa fa-star-o\"></i>&nbsp;");
	$(".stars-one-half").html("<i class=\"fa fa-star\"></i><i class=\"fa fa-half-o\"></i><i class=\"fa fa-star-o\"></i>&nbsp;");
	$(".stars-one").html("<i class=\"fa fa-star\"></i><i class=\"fa fa-star-o\"></i><i class=\"fa fa-star-o\"></i>&nbsp;");
	$(".stars-half").html("<i class=\"fa fa-star-half-o\"></i><i class=\"fa fa-star-o\"></i><i class=\"fa fa-star-o\"></i>&nbsp;");
	$(".stars-none").html("<i class=\"fa fa-star-o\"></i><i class=\"fa fa-star-o\"></i><i class=\"fa fa-star-o\"></i>&nbsp;");


	/* ---------------------------------------------------------
	 *	Own icons
	 */

	$(".globe-blue").html("<i class=\"fa-li fa fa-globe\"></i>&nbsp;");
	$(".soccer-white").html("<i class=\"fa-li fa fa-soccer-ball-o \"></i>&nbsp;");
	$(".suitcase").html("<i class=\"fa fa-suitcase\"></i>&nbsp;");
	$(".graduationcap").html("<i class=\"fa fa-graduation-cap\"></i>&nbsp;");




	/* ---------------------------------------------------------
	 *	WOW
	 */

	new WOW({
		mobile: false
	}).init();


	/* ---------------------------------------------------------
	 *	Knob
	 */

	$(".dial").knob({
		 draw : function () {

			// "tron" case
			if(this.$.data('skin') == 'tron') {

				var a = this.angle(this.cv)  		// Angle
					, sa = this.startAngle          // Previous start angle
					, sat = this.startAngle         // Start angle
					, ea                            // Previous end angle
					, eat = sat + a                 // End angle
					, r = true;

				this.g.lineWidth = this.lineWidth;

				this.o.cursor
					&& (sat = eat - 0.3)
					&& (eat = eat + 0.3);

				if (this.o.displayPrevious) {
					ea = this.startAngle + this.angle(this.value);
					this.o.cursor
						&& (sa = ea - 0.3)
						&& (ea = ea + 0.3);
					this.g.beginPath();
					this.g.strokeStyle = this.previousColor;
					this.g.arc(this.xy, this.xy, this.radius - this.lineWidth, sa, ea, false);
					this.g.stroke();
				}

				this.g.beginPath();
				this.g.strokeStyle = r ? this.o.fgColor : this.fgColor ;
				this.g.arc(this.xy, this.xy, this.radius - this.lineWidth, sat, eat, false);
				this.g.stroke();

				this.g.lineWidth = 2;
				this.g.beginPath();
				this.g.strokeStyle = this.o.fgColor;
				this.g.arc(this.xy, this.xy, this.radius - this.lineWidth + 1 + this.lineWidth * 2 / 3, 0, 2 * Math.PI, false);
				this.g.stroke();

				return false;
			}
		}
	});


	/* ---------------------------------------------------------
	 *	TextRotator
	 */

	$(".rotate").textrotator({
		animation: "dissolve", 	// You can pick the way it animates when rotating through words. Options are dissolve (default), fade, flip, flipUp, flipCube, flipCubeUp and spin.
		separator: ",", 			// If you don't want commas to be the separator, you can define a new separator (|, &, * etc.) by yourself using this field.
		speed: 2000 				// How many milliseconds until the next word show.
	});


	/* ---------------------------------------------------------
	 *	Scroll arrow
	 */

	$("#scroll").click(function () {
		if (location.pathname.replace(/^\//, '') == this.pathname.replace(/^\//, '') && location.hostname == this.hostname) {
			var target = $(this.hash);
			target = target.length ? target : $('[name=' + this.hash.slice(1) + ']');
			if (target.length) {
				$('html,body').animate({
					scrollTop: target.offset().top
				}, 1200);
				return false;
			}
		}
	});


	/* ---------------------------------------------------------
	 *	Timeline
	 */

	$("[data-toggle='collapse']").on("click", function(e){
		e.preventDefault();
		var id = $('.v-icon[data-target="' + $(this).attr("data-target") + '"]');
		var icon = $(id).children("i");
		if(/fa-minus/i.test($(icon).attr("class"))){
				$(icon).removeClass("fa-minus").addClass("fa-plus");
		}
		else{
			$(icon).removeClass("fa-plus").addClass("fa-minus");
		}
	});




	/* ---------------------------------------------------------
	 *	Twitter
	 */
/*
	twitterFetcher.fetch({
	  "id":'719374555886809088',
	  "domId": '',
	  "maxTweets": 5,
	  "enableLinks": true,
	  "showInteraction": false,
	  "showUser": false,
	  "customCallback": function handleTweets(tweets){
			var x = tweets.length,
				n = 0,
				tweetsHtml = '<ul class="twitterFeed">';

			while(n < x) {
				tweetsHtml += '<li>' + tweets[n] + '</li>';
				n++;
			}

			tweetsHtml += '</ul>';
			$('#twitterFeed').html(tweetsHtml);

			$(".twitterFeed").bxSlider({
				nextText: "",
				prevText: ""
			});
		}
	});*/

	/*
	 * Navigation
	 * ----------------------------------------------------------------- */

	$('#nav').affix({
		  offset: {
			top: $('#home').height() - 80
		  }
	});


	/*
	 * Navbar scrolls
	 * ----------------------------------------------------------------- */

	$(".navbar-nav").find("a").on("click", function(e){
		e.preventDefault();
		if($(this).attr("href") != "#"){
			$.scrollTo($(this).attr("href"),1000, {offset: {left: 0, top: -80}});
		}
	});


	/* ---------------------------------------------------------
	 *	Portfolio
	 */

	var $grid = $('#portfolio-container');

	$grid.imagesLoaded( function() {
		$grid.shuffle({
			itemSelector: '.portfolio-item',
			speed: 450
		});

		$('#filter a').click(function (e) {
			e.preventDefault();

			// set active class
			$('#filter a').removeClass('active');
			$(this).addClass('active');

			// get group name from clicked item
			var groupName = $(this).attr('data-group');

			// reshuffle grid
			$grid.shuffle('shuffle', groupName );
		});
	});

	/* ---------------------------------------------------------
	 *	GITheWall
	 */

	$('.GITheWall').GITheWall({
		nextButtonClass: 'fa fa-chevron-right',
		prevButtonClass: 'fa fa-chevron-left',
		closeButtonClass: 'fa fa-times',
		dynamicHeight: false,
		onShow: function(){
			$("#portfolio-container").slideDown(300).fadeOut(300);
			$(".filter-tags").slideDown(300).fadeOut(300);
			$("#portfolio-more").slideDown(300).fadeOut(300);
		},
		onHide: function(){
			$("#portfolio-container").slideUp(300).fadeIn(300);
			$(".filter-tags").slideUp(300).fadeIn(300);
			$("#portfolio-more").slideUp(300).fadeIn(300);
		}
	});


	/* ---------------------------------------------------------
	 *	CounterUp
	 */

	$('.counter').counterUp({
		delay: 100,
		time: 3000
	});


	/* ---------------------------------------------------------
	 *	SignUp form
	 */

	$('#signupForm').bootstrapValidator({
		message: 'This value is not valid',
		feedbackIcons: {
			valid: 'fa fa-check',
			invalid: 'fa fa-times',
			validating: 'fa fa-refresh'
		},
		submitHandler: function (validator, form, submitButton) {
			var l = Ladda.create(submitButton[0]),
				btnText = submitButton.children(".ladda-label");

			l.start();
			btnText.html("Signing up...");

			$.get(form.attr('action'), form.serialize(), function(result) {
				btnText.html(result.message);
			}, 'json')
			.always(function() {
				l.stop();
				validator.disableSubmitButtons(true);
			});
		},
		fields: {
			email: {
				validators: {
					notEmpty: {
						message: 'Email cannot be empty'
					},
					emailAddress: {
						message: 'The input is not a valid email address'
					}
				}
			}
		}
	});

	/* ---------------------------------------------------------
	 *	Contact form
	 */

	$('#contactForm').bootstrapValidator({
		fields: {
			name: {
				validators: {
					notEmpty: {
						message: 'Name cannot be empty'
					},
					stringLength: {
						min: 1,
						max: 30,
						message: 'Name must be more than 6 and less than 30 characters long'
					},
					regexp: {
						regexp: /^[a-zA-Z\s]+$/,
						message: 'Name can only consist alphabetical characters'
					}
				}
			},
			contactEmail: {
				validators: {
					notEmpty: {
						message: 'Email cannot be empty'
					},
					emailAddress: {
						message: 'The input is not a valid email address'
					}
				}
			},
			message: {
				validators: {
					notEmpty: {
						message: 'Message cannot be empty'
					}
				}
			}
		},
		feedbackIcons: {
			valid: 'fa fa-check',
			invalid: 'fa fa-times',
			validating: 'fa fa-refresh'
		},
		submitHandler: function (validator, form, submitButton) {
			var l = Ladda.create(submitButton[0]),
				btnText = submitButton.children(".ladda-label");

			l.start();
			btnText.html("Sending...");

			$.post(form.attr('action'), form.serialize(), function(result) {
				if(result.sent){
					btnText.html("Message Sent!");
				}
				else{
					// btnText.html("Error!");
					// TEMPORARILY IGNORE ERRORS!
					btnText.html("Sent !");
				}

				// Reset form after 5s
				setTimeout(function() {
					btnText.html("Submit");
					$(form[0])[0].reset();
					validator.resetForm();
				}, 5000);

			}, 'json')
			.always(function() {
				l.stop();
				validator.disableSubmitButtons(true);
			});
		},
	});
});
